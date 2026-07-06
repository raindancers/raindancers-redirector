"""
CSV Loader Lambda.

Triggered by S3 ObjectCreated events on files matching `imports/*.csv`.
Downloads the CSV, validates each row, normalises paths, checks for duplicates,
and batch-writes valid entries to DynamoDB.

Environment Variables:
    TABLE_NAME: DynamoDB table name for redirect entries.
    BUCKET_NAME: S3 bucket name (for writing logs and errors).
    ALLOWED_DOMAINS: JSON array of valid source domain names.
    ENFORCE_NO_REDIRECT_CHAINS: 'true' or 'false' — when true, targets must return 200 OK.
    NORMALISATION_RULES: JSON array of normalisation rule names to apply to paths.
    DROP_QUERY_PARAMS: JSON array of faceted param names (used by normalisation).
    DROP_TRACKING_PARAMS: JSON array of tracking param names (used by normalisation).

Input:
    CSV file in S3 with columns: source_domain, source_path, target_url, status_code

Outputs:
    - logs/{filename}-{timestamp}.json — JSON log with summary and per-row outcomes
    - errors/{filename}-{timestamp}.csv — CSV of rejected rows with error reasons
    - DynamoDB entries for valid, non-duplicate rows

Validation Rules:
    - source_domain must be in ALLOWED_DOMAINS (after normalisation)
    - source_path must not be empty
    - status_code must be 301, 302, or 410
    - target_url required for 301/302 (not for 410)
    - No redirect loops (target host != source domain)
    - Target URL must be reachable (HEAD then GET fallback)
    - When ENFORCE_NO_REDIRECT_CHAINS: target must return 200, not 3xx
    - Duplicate entries (pk already in DynamoDB) are skipped
"""

import csv
import io
import json
import logging
import os
import re
import time
import urllib.parse
import urllib.request

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ['TABLE_NAME']
BUCKET_NAME = os.environ['BUCKET_NAME']
ALLOWED_DOMAINS = json.loads(os.environ.get('ALLOWED_DOMAINS', '[]'))
ENFORCE_NO_REDIRECT_CHAINS = os.environ.get('ENFORCE_NO_REDIRECT_CHAINS', 'true').lower() == 'true'
NORMALISATION_RULES = json.loads(os.environ.get('NORMALISATION_RULES', '[]'))
DROP_QUERY_PARAMS = json.loads(os.environ.get('DROP_QUERY_PARAMS', '[]'))
DROP_TRACKING_PARAMS = json.loads(os.environ.get('DROP_TRACKING_PARAMS', '[]'))

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)
s3 = boto3.client('s3')

# Valid status codes for redirects
VALID_STATUS_CODES = {301, 302, 410}


def handler(event, context):
    """
    S3 event handler entry point.

    Iterates over S3 event records, filters for .csv files, and processes each one.

    Args:
        event: S3 event notification with Records array containing bucket/key info.
        context: Lambda context (unused).
    """
    for record in event.get('Records', []):
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'])

        if not key.endswith('.csv'):
            logger.info(f'Skipping non-CSV file: {key}')
            continue

        logger.info(f'Processing CSV: s3://{bucket}/{key}')
        process_csv(bucket, key)


def process_csv(bucket: str, key: str):
    """
    Download a CSV from S3 and process all rows.

    For each row: validates, checks for duplicates, builds DynamoDB item,
    and records the outcome in the log. After processing all rows, writes
    valid items to DynamoDB in batches, then outputs log and error files.

    Args:
        bucket: S3 bucket name containing the CSV.
        key: S3 object key (e.g. 'imports/my-redirects.csv').
    """
    response = s3.get_object(Bucket=bucket, Key=key)
    content = response['Body'].read().decode('utf-8')

    reader = csv.DictReader(io.StringIO(content))

    # Validate CSV has required columns
    required_fields = {'source_domain', 'source_path', 'target_url', 'status_code'}
    if reader.fieldnames is None or not required_fields.issubset(set(reader.fieldnames)):
        logger.error(f'CSV missing required columns. Expected: {required_fields}')
        return

    valid_items = []
    error_rows = []
    log_entries = []
    total = 0
    duplicates = 0

    for row_num, row in enumerate(reader, start=2):  # start=2 accounts for header row
        total += 1
        process_time = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        # Validate the row
        validation_result = validate_row_with_details(row)

        if validation_result['errors']:
            error_rows.append({**row, 'row_number': row_num, 'errors': '; '.join(validation_result['errors'])})
            log_entries.append({
                'row_number': row_num,
                'source_domain': row.get('source_domain', ''),
                'source_path': row.get('source_path', ''),
                'target_url': row.get('target_url', ''),
                'status_code': row.get('status_code', ''),
                'outcome': 'error',
                'detail': '; '.join(validation_result['errors']),
                'target_response_headers': '',
                'processed_at': process_time,
            })
            continue

        # Build the DynamoDB item
        item = build_item(row)

        # Check for existing entry (duplicate detection)
        if is_duplicate(item['pk']):
            duplicates += 1
            log_entries.append({
                'row_number': row_num,
                'source_domain': row.get('source_domain', ''),
                'source_path': row.get('source_path', ''),
                'target_url': row.get('target_url', ''),
                'status_code': row.get('status_code', ''),
                'outcome': 'duplicate',
                'detail': f'Entry already exists for pk: {item["pk"]}',
                'target_response_headers': '',
                'processed_at': process_time,
            })
            continue

        # Record success with target response info
        valid_items.append(item)
        log_entries.append({
            'row_number': row_num,
            'source_domain': row.get('source_domain', ''),
            'source_path': row.get('source_path', ''),
            'target_url': row.get('target_url', ''),
            'status_code': row.get('status_code', ''),
            'outcome': 'success',
            'detail': f'Written to DynamoDB as pk: {item["pk"]}',
            'target_response_headers': validation_result.get('response_headers', ''),
            'processed_at': process_time,
        })

    # Batch write valid items to DynamoDB
    written = batch_write_items(valid_items)

    # Write log file to S3 (always)
    write_log(bucket, key, log_entries)

    # Write errors to S3 (if any)
    if error_rows:
        write_errors(bucket, key, error_rows)

    logger.info(
        f'CSV processing complete: '
        f'total={total}, written={written}, duplicates={duplicates}, errors={len(error_rows)}'
    )


def validate_row_with_details(row: dict) -> dict:
    """
    Validate a single CSV row and capture response header details.

    Performs all validation checks in sequence. Stops early for 410 entries
    (which don't need target validation) and for empty targets.

    Args:
        row: Dict with keys source_domain, source_path, target_url, status_code.

    Returns:
        dict with:
            'errors': list of error message strings (empty if valid)
            'response_headers': formatted HTTP headers from target check (for logging)
    """
    errors = []
    response_headers = ''

    source_domain = row.get('source_domain', '').strip()
    source_path = row.get('source_path', '').strip()
    target_url = row.get('target_url', '').strip()
    status_code_str = row.get('status_code', '').strip()

    if not source_domain:
        errors.append('source_domain is empty')
    elif ALLOWED_DOMAINS and normalise_domain(source_domain) not in ALLOWED_DOMAINS:
        errors.append(
            f'source_domain "{source_domain}" is not in the allowed domains list: {ALLOWED_DOMAINS}'
        )

    if not source_path:
        errors.append('source_path is empty')

    if not status_code_str:
        errors.append('status_code is empty')
    else:
        try:
            status_code = int(status_code_str)
            if status_code not in VALID_STATUS_CODES:
                errors.append(f'status_code must be one of {VALID_STATUS_CODES}')
        except ValueError:
            errors.append(f'status_code is not a valid integer: {status_code_str}')

    # 410 entries don't need a target URL
    if status_code_str == '410':
        return {'errors': errors, 'response_headers': ''}

    if not target_url:
        errors.append('target_url is empty (required for 301/302)')
        return {'errors': errors, 'response_headers': ''}

    # Check for redirect loops: target host must not match source domain
    try:
        parsed_target = urllib.parse.urlparse(target_url)
        target_host = parsed_target.hostname or ''
        normalised_source = normalise_domain(source_domain)
        if target_host == normalised_source or target_host == f'www.{normalised_source}':
            errors.append(f'redirect loop: target host {target_host} matches source domain')
    except Exception:
        errors.append(f'target_url is not a valid URL: {target_url}')

    # Check target URL reachability and redirect chains
    if not errors:
        target_result = check_target_with_headers(target_url)
        if target_result['error']:
            errors.append(target_result['error'])
        response_headers = target_result.get('headers', '')

    return {'errors': errors, 'response_headers': response_headers}


def check_target_with_headers(url: str) -> dict:
    """
    Check whether a target URL is reachable and capture response headers.

    Delegates to either no-chains or follows-redirects check based on
    ENFORCE_NO_REDIRECT_CHAINS setting.

    Args:
        url: The target URL to verify.

    Returns:
        dict with:
            'error': error message string if check failed, None if OK
            'headers': formatted HTTP response headers for logging
    """
    if ENFORCE_NO_REDIRECT_CHAINS:
        return check_target_no_chains_with_headers(url)
    else:
        return check_target_follows_redirects_with_headers(url)


def check_target_no_chains_with_headers(url: str) -> dict:
    """
    Verify target URL returns 200 OK without following redirects.

    Uses a custom urllib opener that suppresses automatic redirect following.
    Tries HEAD first, falls back to GET if HEAD returns non-200/non-3xx.

    A 3xx response indicates a redirect chain which violates the
    enforceNoRedirectChains policy.

    Args:
        url: Target URL to check.

    Returns:
        dict with 'error' (None on success, message on failure) and
        'headers' (formatted response headers for logging).
    """
    try:
        class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirectHandler)
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'RedirectService-CSVLoader/1.0')

        try:
            resp = opener.open(req, timeout=10)
            status = resp.status
            headers = format_headers(resp.headers)
        except urllib.error.HTTPError as e:
            status = e.code
            headers = format_headers(e.headers)

        if 300 <= status < 400:
            return {
                'error': (
                    f'target_url returns {status} (redirect chain detected). '
                    f'Target must return 200 OK when enforceNoRedirectChains is enabled: {url}'
                ),
                'headers': headers,
            }
        elif status == 200:
            return {'error': None, 'headers': headers}
        else:
            # Try GET as fallback
            req = urllib.request.Request(url, method='GET')
            req.add_header('User-Agent', 'RedirectService-CSVLoader/1.0')
            try:
                resp = opener.open(req, timeout=10)
                status = resp.status
                headers = format_headers(resp.headers)
            except urllib.error.HTTPError as e:
                status = e.code
                headers = format_headers(e.headers)

            if 300 <= status < 400:
                return {
                    'error': (
                        f'target_url returns {status} (redirect chain detected). '
                        f'Target must return 200 OK when enforceNoRedirectChains is enabled: {url}'
                    ),
                    'headers': headers,
                }
            elif 200 <= status < 300:
                return {'error': None, 'headers': headers}
            else:
                return {
                    'error': f'target_url is not reachable (returned {status}): {url}',
                    'headers': headers,
                }

    except Exception as e:
        return {
            'error': f'target_url is not reachable (connection error): {url}',
            'headers': '',
        }


def check_target_follows_redirects_with_headers(url: str) -> dict:
    """
    Verify target URL returns 2xx, following any redirects.

    Used when enforceNoRedirectChains is disabled. Allows the target to
    redirect (3xx) as long as the final destination returns 2xx.
    Tries HEAD first, falls back to GET.

    Args:
        url: Target URL to check.

    Returns:
        dict with 'error' (None on success, message on failure) and
        'headers' (formatted response headers for logging).
    """
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'RedirectService-CSVLoader/1.0')
        with urllib.request.urlopen(req, timeout=10) as resp:
            if 200 <= resp.status < 300:
                return {'error': None, 'headers': format_headers(resp.headers)}
    except Exception:
        pass

    # Try GET as fallback
    try:
        req = urllib.request.Request(url, method='GET')
        req.add_header('User-Agent', 'RedirectService-CSVLoader/1.0')
        with urllib.request.urlopen(req, timeout=10) as resp:
            if 200 <= resp.status < 300:
                return {'error': None, 'headers': format_headers(resp.headers)}
    except Exception:
        pass

    return {
        'error': f'target_url is not reachable (non-2xx response): {url}',
        'headers': '',
    }


def format_headers(headers) -> str:
    """
    Format HTTP response headers as a compact pipe-delimited string for logging.

    Only includes a curated set of interesting headers: content-type, server,
    location, x-cache, cache-control, date. Headers not present are omitted.

    Args:
        headers: HTTP response headers object (from urllib), or None.

    Returns:
        Formatted string (e.g. 'content-type: text/html | server: nginx') or empty string.
    """
    if not headers:
        return ''
    interesting = ['content-type', 'server', 'location', 'x-cache', 'cache-control', 'date']
    parts = []
    for key in interesting:
        value = headers.get(key)
        if value:
            parts.append(f'{key}: {value}')
    return ' | '.join(parts)


def is_duplicate(pk: str) -> bool:
    """
    Check if a redirect entry already exists in DynamoDB.

    Uses a projection expression to minimise read capacity — only fetches
    the key, not the full item. Returns False on any DynamoDB error
    (fail-open to allow the write to proceed).

    Args:
        pk: The partition key to check (e.g. 'example.co.uk#/old-path').

    Returns:
        True if the entry exists, False otherwise.
    """
    try:
        result = table.get_item(
            Key={'pk': pk},
            ProjectionExpression='pk',
        )
        return 'Item' in result
    except Exception:
        return False


def normalise_path(path: str) -> str:
    """
    Apply configured normalisation rules to a URL path.

    Only rules present in NORMALISATION_RULES are applied. A leading slash
    is always ensured regardless of rules (not configurable).

    Must produce the same result as the redirect handler's normalise() function
    to ensure consistent DynamoDB key generation.

    Args:
        path: The URL path to normalise (e.g. '/Products/Widget.html').

    Returns:
        Normalised path string (e.g. '/products/widget').
    """
    if 'LOWERCASE_PATH' in NORMALISATION_RULES:
        path = path.lower()

    if 'COLLAPSE_SLASHES' in NORMALISATION_RULES:
        path = re.sub(r'//+', '/', path)

    if 'STRIP_INDEX_FILES' in NORMALISATION_RULES:
        path = re.sub(r'/(index\.php|index\.html)$', '/', path)

    if 'STRIP_HTML_EXTENSION' in NORMALISATION_RULES:
        path = re.sub(r'\.html$', '', path)

    if 'STRIP_TRAILING_SLASH' in NORMALISATION_RULES:
        if len(path) > 1 and path.endswith('/'):
            path = path.rstrip('/')

    # Ensure leading slash (always applied, not configurable)
    if not path.startswith('/'):
        path = '/' + path

    return path


def normalise_domain(domain: str) -> str:
    """
    Normalise a domain name for consistent DynamoDB key generation.

    Always lowercases. Strips 'www.' prefix only if STRIP_WWW is in
    the configured normalisation rules.

    Args:
        domain: Raw domain string (e.g. '  WWW.Example.CO.UK  ').

    Returns:
        Normalised domain (e.g. 'example.co.uk').
    """
    domain = domain.lower().strip()
    if 'STRIP_WWW' in NORMALISATION_RULES:
        domain = re.sub(r'^www\.', '', domain)
    return domain


def build_item(row: dict) -> dict:
    """
    Build a DynamoDB item from a validated CSV row.

    Normalises the domain and path to produce a consistent partition key.
    Sets the entry type to 'exact' and source to 'csv-import'.
    For 410 entries, the target is set to empty string.

    Args:
        row: Validated CSV row dict with source_domain, source_path, target_url, status_code.

    Returns:
        dict ready for DynamoDB PutItem with keys: pk, type, target, statusCode, source, updatedAt.
    """
    source_domain = normalise_domain(row['source_domain'])
    source_path = normalise_path(row['source_path'].strip())
    target_url = row['target_url'].strip()
    status_code = int(row['status_code'].strip())

    pk = f'{source_domain}#{source_path}'

    item = {
        'pk': pk,
        'type': 'exact',
        'target': target_url,
        'statusCode': status_code,
        'source': 'csv-import',
        'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }

    # 410 entries don't have a target
    if status_code == 410:
        item['target'] = ''

    return item


def batch_write_items(items: list[dict]) -> int:
    """
    Write items to DynamoDB using BatchWriteItem with retry logic.

    Processes items in batches of 25 (DynamoDB BatchWriteItem limit).
    Retries unprocessed items with exponential backoff up to 5 times.

    Args:
        items: List of DynamoDB item dicts to write.

    Returns:
        Number of items successfully written.
    """
    written = 0
    batch_size = 25

    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        request_items = {
            TABLE_NAME: [
                {'PutRequest': {'Item': item}}
                for item in batch
            ],
        }

        retries = 0
        max_retries = 5

        while request_items:
            try:
                response = dynamodb.meta.client.batch_write_item(RequestItems=request_items)
                unprocessed = response.get('UnprocessedItems', {})

                processed = len(batch) - len(unprocessed.get(TABLE_NAME, []))
                written += processed

                if unprocessed:
                    request_items = unprocessed
                    retries += 1
                    if retries > max_retries:
                        logger.error(f'Max retries exceeded for batch starting at index {i}')
                        break
                    wait_time = 2 ** retries * 0.1
                    time.sleep(wait_time)
                else:
                    break

            except ClientError as e:
                logger.error(f'DynamoDB batch write error: {e}')
                break

    return written


def write_log(bucket: str, source_key: str, log_entries: list[dict]):
    """
    Write the full processing log to S3 as a JSON file.

    Output path: logs/{filename_base}-{timestamp}.json

    The JSON structure includes a summary (totals by outcome) and the full
    list of per-row entries with outcome, detail, and response headers.

    Args:
        bucket: S3 bucket name.
        source_key: Original CSV object key (used to derive the log filename).
        log_entries: List of per-row log entry dicts.
    """
    filename = source_key.rsplit('/', 1)[-1] if '/' in source_key else source_key
    filename_base = filename.rsplit('.', 1)[0]
    timestamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    log_key = f'logs/{filename_base}-{timestamp}.json'

    log_data = {
        'source_file': source_key,
        'processed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'summary': {
            'total': len(log_entries),
            'success': sum(1 for e in log_entries if e['outcome'] == 'success'),
            'duplicate': sum(1 for e in log_entries if e['outcome'] == 'duplicate'),
            'error': sum(1 for e in log_entries if e['outcome'] == 'error'),
        },
        'entries': log_entries,
    }

    s3.put_object(
        Bucket=bucket,
        Key=log_key,
        Body=json.dumps(log_data, indent=2).encode('utf-8'),
        ContentType='application/json',
    )

    logger.info(f'Wrote processing log ({len(log_entries)} rows) to s3://{bucket}/{log_key}')


def write_errors(bucket: str, source_key: str, error_rows: list[dict]):
    """
    Write rejected rows to S3 as a CSV file for quick review.

    Output path: errors/{filename_base}-{timestamp}.csv

    Columns: row_number, source_domain, source_path, target_url, status_code, errors

    Args:
        bucket: S3 bucket name.
        source_key: Original CSV object key (used to derive the error filename).
        error_rows: List of error row dicts (original row data + row_number + errors).
    """
    filename = source_key.rsplit('/', 1)[-1] if '/' in source_key else source_key
    filename_base = filename.rsplit('.', 1)[0]
    timestamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    error_key = f'errors/{filename_base}-{timestamp}.csv'

    output = io.StringIO()
    fieldnames = ['row_number', 'source_domain', 'source_path', 'target_url', 'status_code', 'errors']
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for row in error_rows:
        writer.writerow({
            'row_number': row['row_number'],
            'source_domain': row.get('source_domain', ''),
            'source_path': row.get('source_path', ''),
            'target_url': row.get('target_url', ''),
            'status_code': row.get('status_code', ''),
            'errors': row['errors'],
        })

    s3.put_object(
        Bucket=bucket,
        Key=error_key,
        Body=output.getvalue().encode('utf-8'),
        ContentType='text/csv',
    )

    logger.info(f'Wrote {len(error_rows)} error rows to s3://{bucket}/{error_key}')
