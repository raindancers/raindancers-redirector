"""
URL Redirect Handler Lambda.

Receives requests via Lambda Function URL (CloudFront origin) and performs
redirect lookups against DynamoDB. This is the core runtime component of
the redirect service.

Environment Variables:
    TABLE_NAME: DynamoDB table name for redirect lookups.
    NORMALISATION_RULES: JSON array of rule names to apply (e.g. ["STRIP_WWW", "LOWERCASE_PATH"]).
    DROP_QUERY_PARAMS: JSON array of faceted query param names to drop.
    DROP_TRACKING_PARAMS: JSON array of tracking query param names to drop.

Lookup Order:
    1. Normalise the URL (only configured rules are applied)
    2. If normalisation changed the URL, return 301 to normalised form
    3. Exact match: DynamoDB GetItem on {host}#{path}
    4. Pattern match: DynamoDB Query on {host}#__pattern__* entries, evaluate regex in priority order
    5. Fallback: DynamoDB GetItem on {host}#__fallback__
    6. Return 404 if nothing matches

Response Codes:
    200: Never returned (this is a redirect service)
    301: Permanent redirect (exact match, pattern, or fallback)
    302: Temporary redirect (if configured per-entry)
    404: No match found, no fallback configured
    405: Non-GET/HEAD method
    410: Resource permanently removed (no Location header)
"""

import json
import os
import re
import urllib.parse

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ['TABLE_NAME']
NORMALISATION_RULES = json.loads(os.environ.get('NORMALISATION_RULES', '[]'))
DROP_QUERY_PARAMS = json.loads(os.environ.get('DROP_QUERY_PARAMS', '[]'))
DROP_TRACKING_PARAMS = json.loads(os.environ.get('DROP_TRACKING_PARAMS', '[]'))

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    """
    Lambda Function URL handler.

    Parses the incoming request from CloudFront, normalises the URL,
    performs redirect lookup, and returns the appropriate HTTP response.

    Args:
        event: Lambda Function URL event (requestContext.http contains method/path,
               headers contains host, rawQueryString contains query params).
        context: Lambda context (unused).

    Returns:
        dict: HTTP response with statusCode, headers, and body.
    """
    request_context = event.get('requestContext', {})
    http = request_context.get('http', {})

    method = http.get('method', 'GET')
    path = http.get('path', '/')
    raw_query = event.get('rawQueryString', '')

    # Only handle GET and HEAD
    if method not in ('GET', 'HEAD'):
        return response_json(405, 'Method Not Allowed', {})

    # Extract host from headers
    headers = event.get('headers', {})
    host = headers.get('x-forwarded-host', headers.get('host', ''))

    # Phase 1: Normalise
    normalised = normalise(path, host, raw_query)
    norm_host = normalised['host']
    norm_path = normalised['path']
    norm_query = normalised['querystring']

    # Check if normalisation changed the URL — if so, redirect to normalised form
    if needs_normalisation_redirect(host, path, raw_query, norm_host, norm_path, norm_query):
        target = build_normalised_url(norm_host, norm_path, norm_query)
        return redirect_response(301, target)

    # Phase 2: Exact match
    entry = exact_match(norm_host, norm_path)

    # Phase 3: Pattern match
    if entry is None:
        entry = pattern_match(norm_host, norm_path)

    # Phase 4: Fallback
    if entry is None:
        entry = fallback(norm_host)

    # Phase 5: No match
    if entry is None:
        return response_json(404, 'Not Found', {})

    # Build and return redirect response
    return build_response(entry, norm_query)


def normalise(uri: str, host: str, querystring: str) -> dict:
    """
    Apply configured normalisation rules to the request URL.

    Only rules present in NORMALISATION_RULES are applied. If the list is empty,
    the URL passes through unchanged (host is still lowercased for consistent lookup).

    Args:
        uri: The request path (e.g. '/Products/Widget.html').
        host: The request host header (e.g. 'www.example.co.uk').
        querystring: The raw query string (e.g. 'manufacturer=acme&utm_source=google').

    Returns:
        dict with keys 'host', 'path', 'querystring' containing the normalised values.
    """
    path = uri

    if 'STRIP_WWW' in NORMALISATION_RULES:
        host = re.sub(r'^www\.', '', host.lower())
    else:
        host = host.lower()

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

    # Query string handling
    if querystring and ('DROP_FACETED_PARAMS' in NORMALISATION_RULES or 'DROP_TRACKING_PARAMS' in NORMALISATION_RULES):
        params = urllib.parse.parse_qs(querystring)

        if 'DROP_FACETED_PARAMS' in NORMALISATION_RULES:
            for p in DROP_QUERY_PARAMS:
                params.pop(p, None)

        if 'DROP_TRACKING_PARAMS' in NORMALISATION_RULES:
            for p in DROP_TRACKING_PARAMS:
                params.pop(p, None)

        cleaned_query = urllib.parse.urlencode(params, doseq=True)
    else:
        cleaned_query = querystring

    return {'host': host, 'path': path, 'querystring': cleaned_query}


def needs_normalisation_redirect(
    orig_host: str, orig_path: str, orig_query: str,
    norm_host: str, norm_path: str, norm_query: str,
) -> bool:
    """
    Determine whether the URL changed during normalisation.

    If any component changed, the handler should issue a 301 redirect to the
    normalised form before performing the redirect lookup. This ensures a
    single hop regardless of how many normalisation rules are applied.

    Args:
        orig_host: Original request host (lowercased for comparison).
        orig_path: Original request path.
        orig_query: Original query string.
        norm_host: Normalised host.
        norm_path: Normalised path.
        norm_query: Normalised query string.

    Returns:
        True if a normalisation redirect should be issued.
    """
    return (
        orig_host.lower() != norm_host
        or orig_path != norm_path
        or orig_query != norm_query
    )


def build_normalised_url(host: str, path: str, querystring: str) -> str:
    """
    Build a full HTTPS URL from normalised components.

    Args:
        host: Normalised hostname.
        path: Normalised path.
        querystring: Normalised query string (may be empty).

    Returns:
        Full URL string (e.g. 'https://example.co.uk/path?key=value').
    """
    url = f'https://{host}{path}'
    if querystring:
        url = f'{url}?{querystring}'
    return url


def exact_match(host: str, path: str) -> dict | None:
    """
    Look up an exact-match redirect entry in DynamoDB.

    Queries with key format: {host}#{path}

    Args:
        host: Normalised hostname.
        path: Normalised path.

    Returns:
        dict with 'target', 'statusCode', 'type' if found, None otherwise.
    """
    result = table.get_item(Key={'pk': f'{host}#{path}'})
    item = result.get('Item')

    if not item:
        return None

    return {
        'target': item.get('target', ''),
        'statusCode': int(item.get('statusCode', 301)),
        'type': 'exact',
    }


def pattern_match(host: str, path: str) -> dict | None:
    """
    Evaluate regex pattern entries for this domain in priority order.

    Queries DynamoDB for entries with keys between {host}#__pattern__000 and
    {host}#__pattern__999, which returns them sorted by priority number.
    Each pattern's regex is compiled and tested against the path.

    Capture groups in the regex are substituted into the target URL using
    $1, $2, etc. notation.

    KNOWN LIMITATION: No regex complexity validation is performed. Malicious
    or poorly-written regex patterns (e.g. catastrophic backtracking / ReDoS)
    could cause Lambda timeouts. The 5-second Lambda timeout is the mitigation.
    Pattern authors should test regex performance before adding to DynamoDB.

    Args:
        host: Normalised hostname.
        path: Normalised path to match against patterns.

    Returns:
        dict with 'target', 'statusCode', 'fallbackTarget', 'type' if matched,
        None if no patterns match.
    """
    result = table.query(
        KeyConditionExpression=Key('pk').between(
            f'{host}#__pattern__000',
            f'{host}#__pattern__999',
        ),
    )

    for item in result.get('Items', []):
        regex = re.compile(item['pattern'])
        match = regex.match(path)

        if match:
            target = item.get('target', '')
            # Substitute capture groups ($1, $2, etc.)
            for i, group in enumerate(match.groups(), 1):
                target = target.replace(f'${i}', group or '')

            return {
                'target': target,
                'statusCode': int(item.get('statusCode', 301)),
                'fallbackTarget': item.get('fallbackTarget'),
                'type': 'pattern',
            }

    return None


def fallback(host: str) -> dict | None:
    """
    Look up the domain-level fallback entry.

    Queries with key format: {host}#__fallback__

    This is the last resort before returning 404. Fallback entries are
    seeded at deploy time by the FallbackSeeder construct.

    Args:
        host: Normalised hostname.

    Returns:
        dict with 'target', 'statusCode', 'type' if fallback exists, None otherwise.
    """
    result = table.get_item(Key={'pk': f'{host}#__fallback__'})
    item = result.get('Item')

    if not item:
        return None

    return {
        'target': item['target'],
        'statusCode': int(item.get('statusCode', 301)),
        'type': 'fallback',
    }


def build_response(entry: dict, original_querystring: str) -> dict:
    """
    Build the HTTP response for a matched redirect entry.

    For 301/302 entries: builds a redirect response with the target URL.
    Query string from the original request is appended to the target.
    For 410 entries: returns a Gone response with no Location header.

    Args:
        entry: The matched redirect entry (from exact_match, pattern_match, or fallback).
        original_querystring: The normalised query string to append to the target.

    Returns:
        dict: HTTP response with statusCode, headers, and body.
    """
    status_code = entry['statusCode']

    # 410 Gone — no redirect
    if status_code == 410:
        return response_json(410, 'Gone', {})

    # Build redirect location with preserved query string
    location = entry['target']
    if original_querystring:
        separator = '&' if '?' in location else '?'
        location = f'{location}{separator}{original_querystring}'

    return redirect_response(status_code, location)


def redirect_response(status_code: int, location: str) -> dict:
    """
    Build a redirect response with security headers.

    Includes:
    - Location header with the target URL
    - HSTS (2 years, includeSubDomains, preload)
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Cache-Control: 90-day public cache

    Args:
        status_code: HTTP status (301 or 302).
        location: Target URL for the Location header.

    Returns:
        dict: HTTP response.
    """
    return {
        'statusCode': status_code,
        'headers': {
            'location': location,
            'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'cache-control': f'public, max-age=7776000',
        },
        'body': '',
    }


def response_json(status_code: int, description: str, extra_headers: dict) -> dict:
    """
    Build a non-redirect response (404, 405, 410).

    Cache behaviour:
    - 404: no-cache (allow re-check after redirect is added)
    - 410: long cache (resource is permanently gone)
    - Others: no cache-control set

    Args:
        status_code: HTTP status code.
        description: Response body text.
        extra_headers: Additional headers to include.

    Returns:
        dict: HTTP response.
    """
    headers = {
        'content-type': 'text/plain',
        'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        **extra_headers,
    }

    if status_code == 404:
        headers['cache-control'] = 'no-cache, no-store'
    elif status_code == 410:
        headers['cache-control'] = 'public, max-age=7776000'

    return {
        'statusCode': status_code,
        'headers': headers,
        'body': description,
    }
