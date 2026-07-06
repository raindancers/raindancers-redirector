"""
CloudFront Cache Invalidation Lambda.

Triggered by DynamoDB Stream events when redirect entries are modified or removed.
Creates CloudFront invalidation requests to purge stale cached redirects.

Environment Variables:
    DISTRIBUTION_ID: The CloudFront distribution ID to invalidate.

Invalidation Strategy:
    - Exact-match entry changes (pk format: {domain}#{path}):
      Invalidates the specific path only. This is efficient and doesn't
      consume wildcard invalidation quota.

    - Pattern or fallback entry changes (pk contains __pattern__ or __fallback__):
      Triggers a full invalidation (/*) because any cached path could be
      affected by a pattern/fallback change.

Event Filtering:
    Only MODIFY and REMOVE events are processed (configured at the event source).
    INSERT events don't need invalidation since there's nothing cached for new entries.

Error Handling:
    CloudFront API errors are logged and re-raised to trigger DynamoDB Stream
    retry (up to 3 attempts configured on the event source mapping).
"""

import logging
import os
import time

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DISTRIBUTION_ID = os.environ['DISTRIBUTION_ID']

cloudfront = boto3.client('cloudfront')


def handler(event, context):
    """
    DynamoDB Stream event handler.

    Processes stream records to determine which CloudFront paths need
    invalidation, then creates an invalidation batch request.

    Args:
        event: DynamoDB Stream event containing Records array.
               Each record has eventName (MODIFY/REMOVE) and dynamodb.Keys.pk.
        context: Lambda context (unused).
    """
    paths_to_invalidate = []
    needs_full_invalidation = False

    for record in event.get('Records', []):
        event_name = record.get('eventName', '')

        # Only process modifications and deletions
        if event_name not in ('MODIFY', 'REMOVE'):
            continue

        # Get the pk from the stream record
        keys = record.get('dynamodb', {}).get('Keys', {})
        pk = keys.get('pk', {}).get('S', '')

        if not pk:
            continue

        # Pattern or fallback changes require full invalidation
        if '__pattern__' in pk or '__fallback__' in pk:
            needs_full_invalidation = True
            break

        # Exact-match: extract path from pk (format: "domain#/path")
        parts = pk.split('#', 1)
        if len(parts) == 2:
            path = parts[1]
            if path:
                paths_to_invalidate.append(path)

    if needs_full_invalidation:
        invalidate_paths(['/*'])
    elif paths_to_invalidate:
        # Deduplicate paths
        unique_paths = list(set(paths_to_invalidate))
        invalidate_paths(unique_paths)
    else:
        logger.info('No paths to invalidate')


def invalidate_paths(paths: list[str]):
    """
    Create a CloudFront invalidation request for the given paths.

    Uses a millisecond timestamp as the CallerReference to ensure uniqueness.
    Logs the first 10 paths for debugging (avoids flooding logs with large batches).

    Args:
        paths: List of URL paths to invalidate (e.g. ['/old-page', '/products/widget']).
               Use ['/*'] for full invalidation.

    Raises:
        Exception: Re-raises any CloudFront API error to trigger stream retry.
    """
    caller_reference = str(int(time.time() * 1000))

    logger.info(f'Invalidating {len(paths)} path(s): {paths[:10]}...')

    try:
        cloudfront.create_invalidation(
            DistributionId=DISTRIBUTION_ID,
            InvalidationBatch={
                'CallerReference': caller_reference,
                'Paths': {
                    'Quantity': len(paths),
                    'Items': paths,
                },
            },
        )
    except Exception as e:
        logger.error(f'Failed to create invalidation: {e}')
        raise
