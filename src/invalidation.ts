import * as path from 'path';
import {
  Duration,
  Stack,
  aws_cloudfront as cloudfront,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_event_sources as lambda_events,
  aws_sqs as sqs,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';

/**
 * Props for the {@link Invalidation} construct.
 */
export interface InvalidationProps {
  /** The DynamoDB table with the stream to monitor for changes. */
  readonly table: dynamodb.Table;

  /** The CloudFront distribution to invalidate when entries change. */
  readonly distribution: cloudfront.Distribution;
}

/**
 * Lambda function that invalidates CloudFront cache when DynamoDB entries change.
 *
 * Triggered by DynamoDB Streams on MODIFY and REMOVE events. Determines the
 * invalidation strategy based on the entry type:
 *
 * - **Exact-match entries** (`{domain}#{path}`): invalidates the specific path
 * - **Pattern or fallback entries** (`__pattern__` or `__fallback__` in key):
 *   triggers a full invalidation (`/*`) since any cached path could be affected
 *
 * Configuration:
 * - Runtime: Python 3.12
 * - Memory: 128 MB
 * - Timeout: 30 seconds
 * - Batch size: 25 records per invocation
 * - Retry attempts: 3
 * - Event filter: MODIFY and REMOVE only (INSERT events don't need invalidation
 *   since there's nothing cached for new entries)
 *
 * IAM permissions:
 * - DynamoDB Streams read (via event source)
 * - `cloudfront:CreateInvalidation` on the target distribution
 *
 * @example
 *
 * const invalidation = new Invalidation(this, 'Invalidation', {
 *   table: redirectsTable,
 *   distribution: cfDistribution,
 * });
 *
 */
export class Invalidation extends Construct {
  /** The invalidation Lambda function resource. */
  public readonly handler: lambda.Function;

  /** Dead-letter queue for failed DynamoDB Stream events. */
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: InvalidationProps) {
    super(scope, id);

    // DLQ for stream events that fail all retry attempts.
    // Failed events are preserved here for investigation rather than being lost.
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.handler = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda', 'invalidation')),
      memorySize: 128,
      timeout: Duration.seconds(30),
      environment: {
        DISTRIBUTION_ID: props.distribution.distributionId,
      },
    });

    // DynamoDB Stream trigger — only MODIFY and REMOVE events
    this.handler.addEventSource(new lambda_events.DynamoEventSource(props.table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 25,
      retryAttempts: 3,
      onFailure: new lambda_events.SqsDlq(this.deadLetterQueue),
      filters: [
        lambda.FilterCriteria.filter({
          eventName: lambda.FilterRule.isEqual('MODIFY'),
        }),
        lambda.FilterCriteria.filter({
          eventName: lambda.FilterRule.isEqual('REMOVE'),
        }),
      ],
    }));

    // Grant cloudfront:CreateInvalidation scoped to this specific distribution and account
    this.handler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${Stack.of(this).account}:distribution/${props.distribution.distributionId}`],
    }));
  }
}
