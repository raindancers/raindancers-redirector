import {
  RemovalPolicy,
  aws_dynamodb as dynamodb,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';

/**
 * DynamoDB table for storing redirect rules.
 *
 * Uses a single-table design with a string partition key `pk`.
 * Key formats:
 * - Exact match: `{domain}#{path}` (e.g. `example.co.uk#/old-page`)
 * - Pattern: `{domain}#__pattern__{priority}` (e.g. `example.co.uk#__pattern__010`)
 * - Fallback: `{domain}#__fallback__` (e.g. `example.co.uk#__fallback__`)
 *
 * Configuration:
 * - Billing: on-demand (pay-per-request)
 * - Stream: NEW_AND_OLD_IMAGES (for cache invalidation)
 * - Encryption: AWS-managed key
 * - Point-in-time recovery: enabled
 * - Removal policy: RETAIN (data preserved on stack deletion)
 */
export class RedirectsTable extends Construct {
  /** The DynamoDB table resource. */
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
