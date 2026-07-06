import {
  aws_cloudfront as cloudfront,
  aws_dynamodb as dynamodb,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_sns as sns,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { CsvImport } from './csv-import';
import { FallbackSeeder } from './fallback-seeder';
import { Invalidation } from './invalidation';
import { Monitoring } from './monitoring';
import { NormalisationRule, NormalisationRuleConfig } from './normalisation';
import { RedirectDistribution } from './redirect-distribution';
import { RedirectHandler } from './redirect-handler';
import { RedirectWaf } from './redirect-waf';
import { RedirectsTable } from './redirects-table';

/**
 * Represents a legacy domain that should be redirected.
 *
 * Each source domain gets an apex and wildcard ACM certificate SAN,
 * Route 53 A records, and CloudFront aliases. An optional fallback URL
 * is seeded into DynamoDB at deploy time for unmatched paths.
 */
export interface SourceDomain {
  /**
   * The legacy domain to redirect from.
   * Must have a corresponding Route 53 public hosted zone in the same account.
   *
   * @example 'domainA.co.uk'
   */
  readonly domain: string;

  /**
   * Default redirect target for unmatched paths on this domain.
   * When set, a `__fallback__` entry is seeded in DynamoDB at deploy time.
   * Requests that don't match any exact or pattern rule redirect here.
   * If not set, unmatched requests return 404.
   *
   * @example 'https://domainA.com/uk'
   */
  readonly fallbackUrl?: string;
}

/**
 * Props for the {@link RedirectService} construct.
 *
 * @example
 *
 * new RedirectService(this, 'Redirects', {
 *   sourceDomains: [
 *     { domain: 'domainA.co.uk', fallbackUrl: 'https://domainA.com/uk' },
 *     { domain: 'domainA.co.nz', fallbackUrl: 'https://domainA.com/nz' },
 *   ],
 *   normalisationRules: [
 *     { rule: NormalisationRule.STRIP_WWW },
 *     { rule: NormalisationRule.LOWERCASE_PATH },
 *     { rule: NormalisationRule.DROP_FACETED_PARAMS, params: ['manufacturer', 'limit'] },
 *   ],
 *   enforceNoRedirectChains: true,
 * });
 *
 */
export interface RedirectServiceProps {
  /**
   * Source domains to redirect from.
   * Each domain gets a CloudFront alias, ACM certificate SAN (apex + wildcard),
   * and Route 53 A records pointing to the distribution.
   * At least one domain must be provided.
   */
  readonly sourceDomains: SourceDomain[];

  /**
   * CloudFront cache TTL for redirect responses in seconds.
   * Applies to 301 and 302 responses. 404 and 410 responses use their own
   * cache headers set by the Lambda handler.
   *
   * @default 7776000 (90 days)
   */
  readonly cacheTtl?: number;

  /**
   * WAF rate limit — maximum requests per IP address per 5-minute window.
   * Exceeding this triggers a block action.
   *
   * This limit does not apply to verified crawlers (Googlebot, Bingbot, etc.)
   * which are identified and allowed by the AWS Managed Bot Control rule.
   *
   * @default 100
   */
  readonly rateLimitPerIp?: number;

  /**
   * SNS topic to receive CloudWatch alarm notifications.
   * When provided, all alarms (Lambda errors, DynamoDB throttles) send
   * notifications to this topic.
   */
  readonly alertTopic?: sns.ITopic;

  /**
   * Optional KMS key for S3 bucket encryption (SSE-KMS).
   * When provided, the import bucket is encrypted with this key.
   * When omitted, the bucket uses S3-managed encryption (SSE-S3),
   * which is sufficient for non-sensitive redirect mapping data.
   *
   * Use SSE-KMS when compliance frameworks (e.g. PCI-DSS, HIPAA) require
   * customer-managed keys or when you need key rotation control and
   * CloudTrail logging of key usage.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * When true, the CSV loader rejects entries where the target URL returns
   * a 3xx redirect instead of 200 OK. This prevents redirect chains where
   * the legacy URL redirects to a target that itself redirects elsewhere.
   *
   * @default true
   */
  readonly enforceNoRedirectChains?: boolean;

  /**
   * URL normalisation rules to apply before redirect lookup.
   * Rules are applied by both the redirect handler (at request time) and
   * the CSV loader (when building DynamoDB keys).
   *
   * If empty or omitted, no normalisation is performed — URLs are looked up
   * exactly as received.
   *
   * @default [] (no normalisation)
   */
  readonly normalisationRules?: NormalisationRuleConfig[];
}

/**
 * A complete multi-domain URL redirect service.
 *
 * Deploys CloudFront + Lambda Function URL + DynamoDB + WAF + S3 CSV import
 * infrastructure that handles redirect lookups at the edge with automatic
 * cache invalidation when rules change.
 *
 * The redirect handler performs lookups in this order:
 * 1. Normalise the URL (if rules configured)
 * 2. Exact match in DynamoDB (`{domain}#{path}`)
 * 3. Pattern match via regex entries in priority order
 * 4. Domain-level fallback (`{domain}#__fallback__`)
 * 5. Return 404 if nothing matches
 *
 * @example
 *
 * const redirects = new RedirectService(this, 'Redirects', {
 *   sourceDomains: [
 *     { domain: 'old.example.com', fallbackUrl: 'https://new.example.com' },
 *   ],
 * });
 *
 * // Access outputs
 * redirects.distribution;   // CloudFront distribution
 * redirects.table;          // DynamoDB table for direct access
 * redirects.importBucket;   // S3 bucket — upload CSVs to imports/ prefix
 *
 */
export class RedirectService extends Construct {
  /** The CloudFront distribution serving all redirect domains. */
  public readonly distribution: cloudfront.Distribution;

  /** The DynamoDB table storing redirect rules (exact, pattern, fallback entries). */
  public readonly table: dynamodb.Table;

  /** The Lambda function handling redirect lookups. */
  public readonly redirectHandler: lambda.Function;

  /** The Function URL for the redirect handler (used as CloudFront origin). */
  public readonly redirectHandlerUrl: lambda.FunctionUrl;

  /** The S3 bucket for CSV imports. Upload files to the `imports/` prefix. */
  public readonly importBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: RedirectServiceProps) {
    super(scope, id);

    if (props.sourceDomains.length === 0) {
      throw new Error('At least one source domain must be configured');
    }

    const normalisationRules = props.normalisationRules ?? [];

    // Validate: param-based rules must include params
    for (const ruleConfig of normalisationRules) {
      if (ruleConfig.rule === NormalisationRule.DROP_FACETED_PARAMS && (!ruleConfig.params || ruleConfig.params.length === 0)) {
        throw new Error('params must be provided for DROP_FACETED_PARAMS rule');
      }
      if (ruleConfig.rule === NormalisationRule.DROP_TRACKING_PARAMS && (!ruleConfig.params || ruleConfig.params.length === 0)) {
        throw new Error('params must be provided for DROP_TRACKING_PARAMS rule');
      }
    }

    // Extract rule names and param lists for Lambda env vars
    const ruleNames = normalisationRules.map(r => r.rule);
    const dropQueryParams = normalisationRules
      .find(r => r.rule === NormalisationRule.DROP_FACETED_PARAMS)?.params ?? [];
    const dropTrackingParams = normalisationRules
      .find(r => r.rule === NormalisationRule.DROP_TRACKING_PARAMS)?.params ?? [];

    // DynamoDB table
    const tableConstruct = new RedirectsTable(this, 'Table');
    this.table = tableConstruct.table;

    // Redirect handler Lambda with Function URL
    const handlerConstruct = new RedirectHandler(this, 'Handler', {
      table: this.table,
      normalisationRules: ruleNames,
      dropQueryParams: dropQueryParams,
      dropTrackingParams: dropTrackingParams,
    });
    this.redirectHandler = handlerConstruct.handler;
    this.redirectHandlerUrl = handlerConstruct.functionUrl;

    // WAF WebACL
    const wafConstruct = new RedirectWaf(this, 'Waf', {
      rateLimitPerIp: props.rateLimitPerIp,
    });

    // CloudFront distribution + ACM + Route53
    const distributionConstruct = new RedirectDistribution(this, 'Distribution', {
      sourceDomains: props.sourceDomains,
      functionUrl: this.redirectHandlerUrl,
      webAcl: wafConstruct.webAcl,
      cacheTtl: props.cacheTtl,
    });
    this.distribution = distributionConstruct.distribution;

    // S3 import bucket + CSV loader Lambda
    const csvImportConstruct = new CsvImport(this, 'CsvImport', {
      table: this.table,
      allowedDomains: props.sourceDomains.map(d => d.domain),
      enforceNoRedirectChains: props.enforceNoRedirectChains ?? true,
      normalisationRules: ruleNames,
      dropQueryParams: dropQueryParams,
      dropTrackingParams: dropTrackingParams,
      encryptionKey: props.encryptionKey,
    });
    this.importBucket = csvImportConstruct.bucket;

    // Seed fallback entries in DynamoDB for domains with fallbackUrl
    new FallbackSeeder(this, 'FallbackSeeder', {
      table: this.table,
      sourceDomains: props.sourceDomains,
    });

    // Invalidation Lambda (DynamoDB Stream → CloudFront invalidation)
    const invalidationConstruct = new Invalidation(this, 'Invalidation', {
      table: this.table,
      distribution: this.distribution,
    });

    // CloudWatch monitoring and alarms
    new Monitoring(this, 'Monitoring', {
      redirectHandler: this.redirectHandler,
      invalidationHandler: invalidationConstruct.handler,
      table: this.table,
      alertTopic: props.alertTopic,
    });
  }
}
