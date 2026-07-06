import * as path from 'path';
import {
  Duration,
  aws_dynamodb as dynamodb,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_s3_notifications as s3n,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { NormalisationRule } from './normalisation';

/**
 * Props for the {@link CsvImport} construct.
 */
export interface CsvImportProps {
  /** The DynamoDB table to write redirect entries to. */
  readonly table: dynamodb.Table;

  /**
   * List of domains that are valid `source_domain` values in CSV rows.
   * Rows with domains not in this list are rejected during import.
   * Typically populated from the construct's `sourceDomains` prop.
   */
  readonly allowedDomains: string[];

  /**
   * When true, rejects CSV entries where the target URL returns a 3xx redirect
   * instead of 200 OK. Prevents redirect chains.
   */
  readonly enforceNoRedirectChains: boolean;

  /**
   * Normalisation rule names to apply to paths when building DynamoDB keys.
   * Must match the rules used by the redirect handler to ensure consistent lookup.
   */
  readonly normalisationRules: NormalisationRule[];

  /** Faceted/sort query parameters to drop (when DROP_FACETED_PARAMS is in the rules). */
  readonly dropQueryParams: string[];

  /** Tracking query parameters to drop (when DROP_TRACKING_PARAMS is in the rules). */
  readonly dropTrackingParams: string[];

  /**
   * Optional KMS key for S3 bucket encryption (SSE-KMS).
   * When omitted, the bucket uses S3-managed encryption (SSE-S3).
   */
  readonly encryptionKey?: kms.IKey;
}

/**
 * S3 bucket and CSV loader Lambda for bulk-importing redirect rules.
 *
 * Creates:
 * - A versioned S3 bucket (public access blocked, 30-day noncurrent version expiry)
 * - A Python 3.12 Lambda triggered by `ObjectCreated` events on `imports/*.csv`
 *
 * The CSV loader:
 * - Validates each row (domain in allowed list, no loops, target reachable)
 * - Checks for duplicate entries in DynamoDB before writing
 * - Applies normalisation rules to paths (matching the redirect handler)
 * - Batch writes valid entries to DynamoDB
 * - Writes a JSON log to `logs/{filename}-{timestamp}.json`
 * - Writes error rows to `errors/{filename}-{timestamp}.csv`
 *
 * Upload CSVs to `imports/` prefix only — other prefixes do not trigger processing.
 *
 * @example
 *
 * const csvImport = new CsvImport(this, 'Import', {
 *   table: myTable,
 *   allowedDomains: ['example.co.uk', 'example.co.nz'],
 *   enforceNoRedirectChains: true,
 *   normalisationRules: [NormalisationRule.LOWERCASE_PATH],
 *   dropQueryParams: [],
 *   dropTrackingParams: [],
 * });
 *
 */
export class CsvImport extends Construct {
  /** The S3 bucket for CSV imports, logs, and errors. */
  public readonly bucket: s3.Bucket;

  /** The CSV loader Lambda function. */
  public readonly loader: lambda.Function;

  constructor(scope: Construct, id: string, props: CsvImportProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'ImportBucket', {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: props.encryptionKey ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.encryptionKey,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
    });

    this.loader = new lambda.Function(this, 'CsvLoader', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda', 'csv-loader')),
      memorySize: 512,
      timeout: Duration.minutes(5),
      environment: {
        TABLE_NAME: props.table.tableName,
        BUCKET_NAME: this.bucket.bucketName,
        ALLOWED_DOMAINS: JSON.stringify(props.allowedDomains),
        ENFORCE_NO_REDIRECT_CHAINS: props.enforceNoRedirectChains ? 'true' : 'false',
        NORMALISATION_RULES: JSON.stringify(props.normalisationRules),
        DROP_QUERY_PARAMS: JSON.stringify(props.dropQueryParams),
        DROP_TRACKING_PARAMS: JSON.stringify(props.dropTrackingParams),
      },
    });

    // S3 trigger: ObjectCreated on .csv files in imports/ prefix only
    this.bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.loader),
      { prefix: 'imports/', suffix: '.csv' },
    );

    // Grant permissions: read from import bucket, write logs/errors back, read+write DynamoDB
    this.bucket.grantRead(this.loader);
    this.bucket.grantPut(this.loader);
    props.table.grantReadWriteData(this.loader);
  }
}
