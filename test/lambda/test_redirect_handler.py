"""
Unit tests for the redirect handler Lambda.

Tests pure functions: normalise, build_response, needs_normalisation_redirect.
DynamoDB-dependent functions (exact_match, pattern_match, fallback) are tested
via mocked boto3 calls.

Run with: pytest test/lambda/test_redirect_handler.py
"""

import importlib
import sys
import os
import json
from unittest.mock import MagicMock

# Add the Lambda source to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lambda/redirect-handler'))

# Set up mocks before import
os.environ['TABLE_NAME'] = 'test-table'
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

# Remove any cached version
if 'index' in sys.modules:
    del sys.modules['index']

import index as handler

# Restore
boto3.resource = _original_resource


class TestNormalise:
    """Test URL normalisation rules."""

    def test_strips_www(self):
        result = handler.normalise('/path', 'www.example.co.uk', '')
        assert result['host'] == 'example.co.uk'

    def test_lowercases_host(self):
        result = handler.normalise('/path', 'EXAMPLE.CO.UK', '')
        assert result['host'] == 'example.co.uk'

    def test_lowercases_path(self):
        result = handler.normalise('/Products/Widget', 'example.co.uk', '')
        assert result['path'] == '/products/widget'

    def test_collapses_double_slashes(self):
        result = handler.normalise('/path//to///page', 'example.co.uk', '')
        assert result['path'] == '/path/to/page'

    def test_strips_html_suffix(self):
        result = handler.normalise('/page.html', 'example.co.uk', '')
        assert result['path'] == '/page'

    def test_strips_index_php(self):
        result = handler.normalise('/category/index.php', 'example.co.uk', '')
        assert result['path'] == '/category'

    def test_strips_index_html(self):
        result = handler.normalise('/category/index.html', 'example.co.uk', '')
        assert result['path'] == '/category'

    def test_strips_trailing_slash(self):
        result = handler.normalise('/path/', 'example.co.uk', '')
        assert result['path'] == '/path'

    def test_preserves_root_slash(self):
        result = handler.normalise('/', 'example.co.uk', '')
        assert result['path'] == '/'

    def test_drops_faceted_params(self):
        result = handler.normalise('/products', 'example.co.uk', 'manufacturer=acme&limit=10&orderby=price')
        assert 'manufacturer' not in result['querystring']
        assert 'limit' not in result['querystring']
        assert 'orderby' not in result['querystring']

    def test_preserves_tracking_params(self):
        result = handler.normalise('/products', 'example.co.uk', 'utm_source=google&fbclid=abc123')
        assert 'utm_source=google' in result['querystring']
        assert 'fbclid=abc123' in result['querystring']

    def test_drops_product_list_order(self):
        result = handler.normalise('/products', 'example.co.uk', 'product_list_order=name&p=2')
        assert 'product_list_order' not in result['querystring']
        assert 'p=' not in result['querystring']

    def test_combined_normalisation(self):
        """All rules applied in a single pass."""
        result = handler.normalise('/Products//Category/index.html', 'WWW.EXAMPLE.CO.UK', 'manufacturer=acme&utm_source=fb')
        assert result['host'] == 'example.co.uk'
        assert result['path'] == '/products/category'
        assert 'manufacturer' not in result['querystring']
        assert 'utm_source=fb' in result['querystring']

    def test_empty_querystring(self):
        result = handler.normalise('/path', 'example.co.uk', '')
        assert result['querystring'] == ''

    def test_drops_tracking_params_when_enabled(self):
        """DROP_TRACKING_PARAMS drops params from the configured list."""
        original_rules = handler.NORMALISATION_RULES
        handler.NORMALISATION_RULES = ['DROP_TRACKING_PARAMS']
        try:
            result = handler.normalise('/path', 'example.co.uk', 'utm_source=google&fbclid=abc&gclid=xyz&keep=me')
            assert 'utm_source' not in result['querystring']
            assert 'fbclid' not in result['querystring']
            assert 'gclid' not in result['querystring']
            assert 'keep=me' in result['querystring']
        finally:
            handler.NORMALISATION_RULES = original_rules

    def test_preserves_tracking_params_when_not_enabled(self):
        """Without DROP_TRACKING_PARAMS, tracking params are preserved."""
        original_rules = handler.NORMALISATION_RULES
        handler.NORMALISATION_RULES = ['DROP_FACETED_PARAMS']
        try:
            result = handler.normalise('/path', 'example.co.uk', 'utm_source=google&manufacturer=acme')
            assert 'utm_source=google' in result['querystring']
            assert 'manufacturer' not in result['querystring']
        finally:
            handler.NORMALISATION_RULES = original_rules


class TestNeedsNormalisationRedirect:
    """Test whether normalisation triggers a redirect."""

    def test_no_redirect_when_already_normalised(self):
        assert not handler.needs_normalisation_redirect(
            'example.co.uk', '/path', '',
            'example.co.uk', '/path', '',
        )

    def test_redirect_when_host_changes(self):
        assert handler.needs_normalisation_redirect(
            'www.example.co.uk', '/path', '',
            'example.co.uk', '/path', '',
        )

    def test_redirect_when_path_changes(self):
        assert handler.needs_normalisation_redirect(
            'example.co.uk', '/Path/', '',
            'example.co.uk', '/path', '',
        )

    def test_redirect_when_query_changes(self):
        assert handler.needs_normalisation_redirect(
            'example.co.uk', '/path', 'manufacturer=acme&utm=x',
            'example.co.uk', '/path', 'utm=x',
        )


class TestBuildResponse:
    """Test response building."""

    def test_301_redirect(self):
        entry = {'target': 'https://example.com/new', 'statusCode': 301, 'type': 'exact'}
        result = handler.build_response(entry, '')
        assert result['statusCode'] == 301
        assert result['headers']['location'] == 'https://example.com/new'

    def test_302_redirect(self):
        entry = {'target': 'https://example.com/temp', 'statusCode': 302, 'type': 'exact'}
        result = handler.build_response(entry, '')
        assert result['statusCode'] == 302
        assert result['headers']['location'] == 'https://example.com/temp'

    def test_410_gone(self):
        entry = {'target': '', 'statusCode': 410, 'type': 'exact'}
        result = handler.build_response(entry, '')
        assert result['statusCode'] == 410
        assert 'location' not in result.get('headers', {})

    def test_query_string_appended(self):
        entry = {'target': 'https://example.com/new', 'statusCode': 301, 'type': 'exact'}
        result = handler.build_response(entry, 'utm_source=google')
        assert result['headers']['location'] == 'https://example.com/new?utm_source=google'

    def test_query_string_merged_with_existing(self):
        entry = {'target': 'https://example.com/new?ref=old', 'statusCode': 301, 'type': 'exact'}
        result = handler.build_response(entry, 'utm_source=google')
        assert result['headers']['location'] == 'https://example.com/new?ref=old&utm_source=google'

    def test_empty_query_string_not_appended(self):
        entry = {'target': 'https://example.com/new', 'statusCode': 301, 'type': 'exact'}
        result = handler.build_response(entry, '')
        assert result['headers']['location'] == 'https://example.com/new'


class TestRedirectResponse:
    """Test security headers on redirect responses."""

    def test_hsts_header(self):
        result = handler.redirect_response(301, 'https://example.com')
        assert 'max-age=63072000' in result['headers']['strict-transport-security']

    def test_x_content_type_options(self):
        result = handler.redirect_response(301, 'https://example.com')
        assert result['headers']['x-content-type-options'] == 'nosniff'

    def test_x_frame_options(self):
        result = handler.redirect_response(301, 'https://example.com')
        assert result['headers']['x-frame-options'] == 'DENY'

    def test_cache_control(self):
        result = handler.redirect_response(301, 'https://example.com')
        assert 'max-age=7776000' in result['headers']['cache-control']


class TestResponseJson:
    """Test non-redirect responses."""

    def test_404_no_cache(self):
        result = handler.response_json(404, 'Not Found', {})
        assert result['statusCode'] == 404
        assert 'no-cache' in result['headers']['cache-control']

    def test_410_cached(self):
        result = handler.response_json(410, 'Gone', {})
        assert result['statusCode'] == 410
        assert 'max-age=7776000' in result['headers']['cache-control']

    def test_405_method_not_allowed(self):
        result = handler.response_json(405, 'Method Not Allowed', {})
        assert result['statusCode'] == 405


class TestExactMatch:
    """Test exact match DynamoDB lookup."""

    def test_returns_entry_on_hit(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'pk': 'example.co.uk#/old-path',
                'target': 'https://example.com/new-path',
                'statusCode': 301,
                'type': 'exact',
            },
        }
        handler.table = mock_table

        result = handler.exact_match('example.co.uk', '/old-path')
        assert result is not None
        assert result['target'] == 'https://example.com/new-path'
        assert result['statusCode'] == 301

    def test_returns_none_on_miss(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        handler.table = mock_table

        result = handler.exact_match('example.co.uk', '/nonexistent')
        assert result is None


class TestPatternMatch:
    """Test pattern match DynamoDB query."""

    def test_matches_regex_with_capture_group(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'pk': 'example.co.uk#__pattern__010',
                    'pattern': r'/blog/(.*)',
                    'target': 'https://example.com/uk/blog/$1',
                    'statusCode': 301,
                },
            ],
        }
        handler.table = mock_table

        result = handler.pattern_match('example.co.uk', '/blog/my-post')
        assert result is not None
        assert result['target'] == 'https://example.com/uk/blog/my-post'
        assert result['statusCode'] == 301

    def test_returns_none_when_no_patterns_match(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'pk': 'example.co.uk#__pattern__010',
                    'pattern': r'/blog/(.*)',
                    'target': 'https://example.com/uk/blog/$1',
                    'statusCode': 301,
                },
            ],
        }
        handler.table = mock_table

        result = handler.pattern_match('example.co.uk', '/products/widget')
        assert result is None

    def test_evaluates_patterns_in_priority_order(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'pk': 'example.co.uk#__pattern__010',
                    'pattern': r'/shop/(.*)',
                    'target': 'https://example.com/store/$1',
                    'statusCode': 301,
                },
                {
                    'pk': 'example.co.uk#__pattern__020',
                    'pattern': r'/shop/sale(.*)',
                    'target': 'https://example.com/clearance/$1',
                    'statusCode': 301,
                },
            ],
        }
        handler.table = mock_table

        # First pattern should match (priority 010 < 020)
        result = handler.pattern_match('example.co.uk', '/shop/sale-items')
        assert result is not None
        assert result['target'] == 'https://example.com/store/sale-items'

    def test_returns_none_when_no_patterns_exist(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {'Items': []}
        handler.table = mock_table

        result = handler.pattern_match('example.co.uk', '/anything')
        assert result is None


class TestFallback:
    """Test fallback lookup."""

    def test_returns_fallback_when_configured(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'pk': 'example.co.uk#__fallback__',
                'target': 'https://example.com/uk',
                'statusCode': 301,
            },
        }
        handler.table = mock_table

        result = handler.fallback('example.co.uk')
        assert result is not None
        assert result['target'] == 'https://example.com/uk'
        assert result['statusCode'] == 301

    def test_returns_none_when_no_fallback(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        handler.table = mock_table

        result = handler.fallback('example.co.uk')
        assert result is None


class TestHandler:
    """Test the main handler function."""

    def test_returns_405_for_post(self):
        event = {
            'requestContext': {'http': {'method': 'POST', 'path': '/'}},
            'rawQueryString': '',
            'headers': {'host': 'example.co.uk'},
        }
        result = handler.handler(event, None)
        assert result['statusCode'] == 405

    def test_returns_404_when_no_match(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_table.query.return_value = {'Items': []}
        handler.table = mock_table

        event = {
            'requestContext': {'http': {'method': 'GET', 'path': '/nonexistent'}},
            'rawQueryString': '',
            'headers': {'host': 'example.co.uk'},
        }
        result = handler.handler(event, None)
        assert result['statusCode'] == 404
