import {
  CustomResource,
  Duration,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  custom_resources as cr,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { SourceDomain } from './redirect-service';

/**
 * Props for the {@link FallbackSeeder} construct.
 */
export interface FallbackSeederProps {
  /** The DynamoDB table to seed fallback entries into. */
  readonly table: dynamodb.Table;

  /** Source domains — only those with `fallbackUrl` set will be seeded. */
  readonly sourceDomains: SourceDomain[];
}

/**
 * Custom resource that seeds `__fallback__` entries in DynamoDB at deploy time.
 *
 * For each source domain that has a `fallbackUrl` configured, writes an entry
 * with key `{domain}#__fallback__` to the redirects table. This entry is used
 * by the redirect handler as the last-resort redirect when no exact or pattern
 * match is found.
 *
 * Behaviour by CloudFormation event:
 * - **Create/Update**: writes (upserts) all fallback entries
 * - **Delete**: removes all fallback entries
 *
 * If no source domains have `fallbackUrl` set, this construct creates no resources.
 *
 * @example
 *
 * new FallbackSeeder(this, 'Seeder', {
 *   table: redirectsTable,
 *   sourceDomains: [
 *     { domain: 'example.co.uk', fallbackUrl: 'https://example.com/uk' },
 *     { domain: 'example.co.nz' },  // no fallback — skipped
 *   ],
 * });
 *
 */
export class FallbackSeeder extends Construct {
  constructor(scope: Construct, id: string, props: FallbackSeederProps) {
    super(scope, id);

    // Only create the seeder if at least one domain has a fallbackUrl
    const domainsWithFallback = props.sourceDomains.filter(d => d.fallbackUrl);
    if (domainsWithFallback.length === 0) {
      return;
    }

    // Build fallback entries to seed
    const fallbackEntries = domainsWithFallback.map(entry => ({
      domain: entry.domain,
      fallbackUrl: entry.fallbackUrl!,
    }));

    // Custom resource provider Lambda
    const onEventHandler = new lambda.Function(this, 'Handler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    request_type = event['RequestType']
    entries = json.loads(os.environ['FALLBACK_ENTRIES'])

    if request_type in ('Create', 'Update'):
        for entry in entries:
            table.put_item(Item={
                'pk': f"{entry['domain']}#__fallback__",
                'type': 'fallback',
                'target': entry['fallbackUrl'],
                'statusCode': 301,
                'source': 'cdk-seeder',
            })

    if request_type == 'Delete':
        for entry in entries:
            table.delete_item(Key={'pk': f"{entry['domain']}#__fallback__"})

    return {'PhysicalResourceId': 'fallback-seeder'}
`),
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: props.table.tableName,
        FALLBACK_ENTRIES: JSON.stringify(fallbackEntries),
      },
    });

    props.table.grantWriteData(onEventHandler);

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: onEventHandler,
    });

    new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
    });
  }
}
