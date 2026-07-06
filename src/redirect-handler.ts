import * as path from 'path';
import {
  Duration,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { NormalisationRule } from './normalisation';

/**
 * Props for the {@link RedirectHandler} construct.
 */
export interface RedirectHandlerProps {
  /** The DynamoDB table to look up redirect rules from. */
  readonly table: dynamodb.Table;

  /**
   * Normalisation rule names to apply before lookup.
   * Passed to the Lambda as the NORMALISATION_RULES environment variable.
   * If empty, no normalisation is performed.
   */
  readonly normalisationRules: NormalisationRule[];

  /**
   * Faceted/sort query parameters to drop when DROP_FACETED_PARAMS is enabled.
   * Passed to the Lambda as the DROP_QUERY_PARAMS environment variable.
   */
  readonly dropQueryParams: string[];

  /**
   * Tracking query parameters to drop when DROP_TRACKING_PARAMS is enabled.
   * Passed to the Lambda as the DROP_TRACKING_PARAMS environment variable.
   */
  readonly dropTrackingParams: string[];
}

/**
 * Lambda function that handles URL redirect lookups.
 *
 * Deployed as a Python 3.12 Lambda with a Function URL (AWS_IAM auth)
 * that serves as the CloudFront origin. The handler performs:
 *
 * 1. URL normalisation (configurable rules)
 * 2. Exact match lookup in DynamoDB
 * 3. Pattern match via regex entries in priority order
 * 4. Domain-level fallback lookup
 * 5. Returns 404 if nothing matches
 *
 * Responses include security headers (HSTS, X-Content-Type-Options, X-Frame-Options)
 * and appropriate cache-control headers (long TTL for redirects, no-cache for 404).
 *
 * The Function URL uses AWS_IAM auth — only CloudFront (via OAC) can invoke it.
 *
 * @example
 *
 * const handler = new RedirectHandler(this, 'Handler', {
 *   table: myTable,
 *   normalisationRules: [NormalisationRule.STRIP_WWW, NormalisationRule.LOWERCASE_PATH],
 *   dropQueryParams: [],
 *   dropTrackingParams: [],
 * });
 *
 */
export class RedirectHandler extends Construct {
  /** The Lambda function resource. */
  public readonly handler: lambda.Function;

  /** The Function URL resource (used as CloudFront origin). */
  public readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: RedirectHandlerProps) {
    super(scope, id);

    this.handler = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda', 'redirect-handler')),
      memorySize: 128,
      timeout: Duration.seconds(5),
      environment: {
        TABLE_NAME: props.table.tableName,
        NORMALISATION_RULES: JSON.stringify(props.normalisationRules),
        DROP_QUERY_PARAMS: JSON.stringify(props.dropQueryParams),
        DROP_TRACKING_PARAMS: JSON.stringify(props.dropTrackingParams),
      },
    });

    this.functionUrl = this.handler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    props.table.grantReadData(this.handler);
  }
}
