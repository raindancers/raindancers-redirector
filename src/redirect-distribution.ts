import {
  Duration,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_lambda as lambda,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { SourceDomain } from './redirect-service';

/**
 * Props for the {@link RedirectDistribution} construct.
 */
export interface RedirectDistributionProps {
  /** Source domains — each gets apex + wildcard aliases, cert SANs, and Route 53 records. */
  readonly sourceDomains: SourceDomain[];

  /** The Lambda Function URL to use as the CloudFront origin (with OAC). */
  readonly functionUrl: lambda.FunctionUrl;

  /** The WAF WebACL to associate with the distribution. */
  readonly webAcl: wafv2.CfnWebACL;

  /**
   * Cache TTL in seconds for redirect responses (301/302).
   * @default 7776000 (90 days)
   */
  readonly cacheTtl?: number;
}

/**
 * CloudFront distribution with ACM certificate, Route 53 records, and WAF.
 *
 * Creates:
 * - ACM certificate with apex + wildcard SANs for all source domains, DNS-validated
 *   via Route 53 hosted zones in the same account
 * - CloudFront distribution with:
 *   - Lambda Function URL origin (Origin Access Control)
 *   - Custom cache policy (Host + URI + query string as cache key)
 *   - Security response headers (HSTS, X-Content-Type-Options, X-Frame-Options)
 *   - WAF WebACL association
 *   - Redirect HTTP → HTTPS viewer protocol
 * - Route 53 A records (apex + wildcard) for each domain pointing to CloudFront
 *
 * Cache key includes query strings because redirect targets vary by query string
 * (REQ-6: query params are appended to the Location header).
 *
 * @example
 *
 * const dist = new RedirectDistribution(this, 'Dist', {
 *   sourceDomains: [{ domain: 'old.example.com' }],
 *   functionUrl: handler.functionUrl,
 *   webAcl: waf.webAcl,
 * });
 *
 */
export class RedirectDistribution extends Construct {
  /** The CloudFront distribution resource. */
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: RedirectDistributionProps) {
    super(scope, id);

    // Collect all domains with wildcards
    const allDomains: string[] = [];
    for (const entry of props.sourceDomains) {
      allDomains.push(entry.domain);
      allDomains.push(`*.${entry.domain}`);
    }

    // Look up hosted zones for DNS validation (zone per apex domain)
    const hostedZones = new Map<string, route53.IHostedZone>();
    for (const entry of props.sourceDomains) {
      if (!hostedZones.has(entry.domain)) {
        hostedZones.set(entry.domain, route53.HostedZone.fromLookup(this, `Zone-${entry.domain}`, {
          domainName: entry.domain,
        }));
      }
    }

    // ACM certificate with apex + wildcard for each source domain
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: allDomains[0],
      subjectAlternativeNames: allDomains.slice(1),
      validation: acm.CertificateValidation.fromDnsMultiZone(
        Object.fromEntries(
          allDomains.map(domain => {
            // Wildcard domains validate against their apex zone
            const apex = domain.startsWith('*.') ? domain.slice(2) : domain;
            return [domain, hostedZones.get(apex)!];
          }),
        ),
      ),
    });

    // Cache policy: cache by Host + URI + query string
    // Query strings are included in the cache key because REQ-6 requires them to be
    // appended to the redirect target URL. Since the Location header varies by query
    // string (e.g. /old?utm=x → /new?utm=x), each unique query string combination
    // must be a separate cache entry to avoid serving incorrect Location headers.
    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      cachePolicyName: `${id}-redirect-cache`,
      defaultTtl: Duration.seconds(props.cacheTtl ?? 7776000),
      maxTtl: Duration.seconds(props.cacheTtl ?? 7776000),
      minTtl: Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('x-forwarded-host'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    });

    // Response headers policy: HSTS, X-Content-Type-Options, X-Frame-Options
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `${id}-security-headers`,
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(63072000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
      },
    });

    // CloudFront distribution with Lambda Function URL origin (OAC)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.FunctionUrlOrigin.withOriginAccessControl(props.functionUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cachePolicy,
        responseHeadersPolicy: responseHeadersPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      domainNames: allDomains,
      certificate: certificate,
      webAclId: props.webAcl.attrArn,
    });

    // Create Route 53 alias records pointing to CloudFront (apex A record + wildcard A record)
    for (const entry of props.sourceDomains) {
      const zone = hostedZones.get(entry.domain)!;

      new route53.ARecord(this, `Alias-${entry.domain}`, {
        zone: zone,
        recordName: entry.domain,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.distribution),
        ),
      });

      new route53.ARecord(this, `Alias-wildcard-${entry.domain}`, {
        zone: zone,
        recordName: `*.${entry.domain}`,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.distribution),
        ),
      });
    }
  }
}
