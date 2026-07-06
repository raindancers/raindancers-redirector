"""
Unit tests for the CSV loader Lambda.

Tests validation, normalisation, duplicate detection, and logging.

Run with: pytest test/lambda/test_csv_loader.py
"""

import sys
import os
import json
from unittest.mock import patch, MagicMock

# Add the Lambda source to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lambda/csv-loader'))

# Set up environment before import
os.environ['TABLE_NAME'] = 'test-table'
os.environ['BUCKET_NAME'] = 'test-bucket'
os.environ['ALLOWED_DOMAINS'] = '["example.co.uk", "example.co.nz"]'
os.environ['ENFORCE_NO_REDIRECT_CHAINS'] = 'true'
os.environ['NORMALISATION_RULES'] = json.dumps([
    'STRIP_WWW', 'LOWERCASE_PATH', 'COLLAPSE_SLASHES',
    'STRIP_HTML_EXTENSION', 'STRIP_INDEX_FILES',
    'STRIP_TRAILING_SLASH', 'DROP_FACETED_PARAMS',
])
os.environ['DROP_QUERY_PARAMS'] = json.dumps([
    'manufacturer', 'limit', 'orderby', 'p', 'product_list_order',
])
os.environ['DROP_TRACKING_PARAMS'] = json.dumps([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'dclid',
])

import boto3
mock_dynamodb_resource = MagicMock()
mock_table = MagicMock()
mock_dynamodb_resource.Table.return_value = mock_table
_original_resource = boto3.resource
boto3.resource = MagicMock(return_value=mock_dynamodb_resource)
_original_client = boto3.client
boto3.client = MagicMock()

if 'index' in sys.modules:
    del sys.modules['index']

import index as loader

boto3.resource = _original_resource
boto3.client = _original_client


class TestNormalisePath:
    """Test path normalisation in the CSV loader."""

    def test_lowercases_path(self):
        assert loader.normalise_path('/Products/Widget') == '/products/widget'

    def test_collapses_double_slashes(self):
        assert loader.normalise_path('/path//to///page') == '/path/to/page'

    def test_strips_html_suffix(self):
        assert loader.normalise_path('/page.html') == '/page'

    def test_strips_index_php(self):
        assert loader.normalise_path('/category/index.php') == '/category'

    def test_strips_trailing_slash(self):
        assert loader.normalise_path('/path/') == '/path'

    def test_preserves_root_slash(self):
        assert loader.normalise_path('/') == '/'

    def test_adds_leading_slash(self):
        assert loader.normalise_path('path') == '/path'


class TestNormaliseDomain:
    """Test domain normalisation."""

    def test_lowercases_domain(self):
        assert loader.normalise_domain('EXAMPLE.CO.UK') == 'example.co.uk'

    def test_strips_www(self):
        assert loader.normalise_domain('www.example.co.uk') == 'example.co.uk'

    def test_strips_whitespace(self):
        assert loader.normalise_domain('  example.co.uk  ') == 'example.co.uk'

    def test_combined(self):
        assert loader.normalise_domain('  WWW.Example.CO.UK  ') == 'example.co.uk'


class TestValidateRowWithDetails:
    """Test CSV row validation with detail capture."""

    def test_valid_301_row(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/old-path',
            'target_url': 'https://example.com/new-path',
            'status_code': '301',
        }
        with patch.object(loader, 'check_target_with_headers', return_value={'error': None, 'headers': 'content-type: text/html'}):
            result = loader.validate_row_with_details(row)
        assert result['errors'] == []
        assert result['response_headers'] == 'content-type: text/html'

    def test_valid_410_row_no_target_required(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/removed-page',
            'target_url': '',
            'status_code': '410',
        }
        result = loader.validate_row_with_details(row)
        assert result['errors'] == []

    def test_empty_source_domain(self):
        row = {
            'source_domain': '',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('source_domain is empty' in e for e in result['errors'])

    def test_source_domain_not_in_allowed_list(self):
        row = {
            'source_domain': 'unknown-domain.com',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('not in the allowed domains list' in e for e in result['errors'])

    def test_source_domain_allowed_with_www(self):
        row = {
            'source_domain': 'www.example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        with patch.object(loader, 'check_target_with_headers', return_value={'error': None, 'headers': ''}):
            result = loader.validate_row_with_details(row)
        assert result['errors'] == []

    def test_empty_source_path(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('source_path is empty' in e for e in result['errors'])

    def test_invalid_status_code(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '200',
        }
        result = loader.validate_row_with_details(row)
        assert any('status_code must be one of' in e for e in result['errors'])

    def test_non_numeric_status_code(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': 'abc',
        }
        result = loader.validate_row_with_details(row)
        assert any('not a valid integer' in e for e in result['errors'])

    def test_redirect_loop_detected(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.co.uk/other-path',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('redirect loop' in e for e in result['errors'])

    def test_redirect_loop_with_www(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://www.example.co.uk/other-path',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('redirect loop' in e for e in result['errors'])

    def test_unreachable_target(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://nonexistent.example.com/page',
            'status_code': '301',
        }
        with patch.object(loader, 'check_target_with_headers', return_value={'error': 'target_url is not reachable', 'headers': ''}):
            result = loader.validate_row_with_details(row)
        assert any('not reachable' in e for e in result['errors'])

    def test_redirect_chain_detected(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/redirects-again',
            'status_code': '301',
        }
        with patch.object(loader, 'check_target_with_headers', return_value={'error': 'redirect chain detected', 'headers': 'location: /somewhere'}):
            result = loader.validate_row_with_details(row)
        assert any('redirect chain' in e for e in result['errors'])

    def test_empty_target_for_301(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': '',
            'status_code': '301',
        }
        result = loader.validate_row_with_details(row)
        assert any('target_url is empty' in e for e in result['errors'])


class TestIsDuplicate:
    """Test duplicate detection."""

    def test_returns_true_when_entry_exists(self):
        loader.table = MagicMock()
        loader.table.get_item.return_value = {'Item': {'pk': 'example.co.uk#/path'}}
        assert loader.is_duplicate('example.co.uk#/path') is True

    def test_returns_false_when_entry_missing(self):
        loader.table = MagicMock()
        loader.table.get_item.return_value = {}
        assert loader.is_duplicate('example.co.uk#/nonexistent') is False

    def test_returns_false_on_error(self):
        loader.table = MagicMock()
        loader.table.get_item.side_effect = Exception('DynamoDB error')
        assert loader.is_duplicate('example.co.uk#/path') is False


class TestFormatHeaders:
    """Test HTTP header formatting for logs."""

    def test_formats_interesting_headers(self):
        headers = MagicMock()
        headers.get = lambda key: {
            'content-type': 'text/html',
            'server': 'nginx',
            'date': 'Thu, 03 Jul 2026 00:00:00 GMT',
        }.get(key)
        result = loader.format_headers(headers)
        assert 'content-type: text/html' in result
        assert 'server: nginx' in result
        assert 'date:' in result

    def test_skips_missing_headers(self):
        headers = MagicMock()
        headers.get = lambda key: None
        result = loader.format_headers(headers)
        assert result == ''

    def test_handles_none_headers(self):
        result = loader.format_headers(None)
        assert result == ''


class TestCheckTargetNoChains:
    """Test target reachability with no-redirect-chains enforcement."""

    def test_returns_none_error_for_200(self):
        with patch('urllib.request.build_opener') as mock_opener:
            mock_resp = MagicMock()
            mock_resp.status = 200
            mock_resp.headers = MagicMock()
            mock_resp.headers.get = lambda key: None
            mock_opener.return_value.open.return_value = mock_resp
            result = loader.check_target_no_chains_with_headers('https://example.com/page')
        assert result['error'] is None

    def test_returns_error_for_301(self):
        import urllib.error
        mock_headers = MagicMock()
        mock_headers.get = lambda key: 'https://elsewhere.com' if key == 'location' else None
        with patch('urllib.request.build_opener') as mock_opener:
            mock_opener.return_value.open.side_effect = urllib.error.HTTPError(
                'https://example.com', 301, 'Moved', mock_headers, None,
            )
            result = loader.check_target_no_chains_with_headers('https://example.com/page')
        assert result['error'] is not None
        assert 'redirect chain detected' in result['error']
        assert 'location' in result['headers']


class TestBuildItem:
    """Test DynamoDB item construction."""

    def test_builds_correct_pk(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/old-path',
            'target_url': 'https://example.com/new-path',
            'status_code': '301',
        }
        item = loader.build_item(row)
        assert item['pk'] == 'example.co.uk#/old-path'

    def test_normalises_domain_in_pk(self):
        row = {
            'source_domain': 'WWW.Example.CO.UK',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        item = loader.build_item(row)
        assert item['pk'] == 'example.co.uk#/path'

    def test_normalises_path_in_pk(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/Path/To/Page.html',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        item = loader.build_item(row)
        assert item['pk'] == 'example.co.uk#/path/to/page'

    def test_sets_type_to_exact(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        item = loader.build_item(row)
        assert item['type'] == 'exact'

    def test_sets_source_to_csv_import(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/path',
            'target_url': 'https://example.com/new',
            'status_code': '301',
        }
        item = loader.build_item(row)
        assert item['source'] == 'csv-import'

    def test_410_entry_has_empty_target(self):
        row = {
            'source_domain': 'example.co.uk',
            'source_path': '/removed',
            'target_url': 'anything',
            'status_code': '410',
        }
        item = loader.build_item(row)
        assert item['target'] == ''
        assert item['statusCode'] == 410
