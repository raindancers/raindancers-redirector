import {
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';

/**
 * Props for the {@link RedirectWaf} construct.
 */
export interface RedirectWafProps {
  /**
   * Maximum requests per IP address per 5-minute window.
   * Exceeding this triggers a block action.
   *
   * Does not apply to verified crawlers (Googlebot, Bingbot, etc.) which are
   * identified by the Bot Control rule and excluded via a scope-down statement.
   *
   * Note: AWS WAF minimum is 100 — values below this are not supported.
   *
   * @default 100
   */
  readonly rateLimitPerIp?: number;
}

/**
 * WAF WebACL for the redirect service CloudFront distribution.
 *
 * Creates a CLOUDFRONT-scoped WebACL with five rules in a specific order
 * designed to maximise protection while minimising cost and avoiding
 * false positives on legitimate crawlers.
 *
 * Rule evaluation order (lowest priority number = evaluated first):
 *
 * 1. **Bot Control** (priority 1) — MUST run first so it can label verified
 *    crawlers (Googlebot, Bingbot, etc.) before rate limiting is evaluated.
 *    Without this ordering, verified crawlers would be rate-limited and blocked
 *    before they're identified. Uses COMMON inspection level.
 *
 * 2. **Rate Limit** (priority 2) — blocks IPs exceeding the configured
 *    threshold per 5-minute window. Includes a scope-down statement that
 *    EXCLUDES requests labelled as verified bots by Bot Control (priority 1).
 *    This ensures legitimate crawlers are never rate-limited regardless of
 *    how aggressively they crawl during re-indexing.
 *
 * 3. **IP Reputation** (priority 3) — blocks requests from IPs known to be
 *    associated with bots, command-and-control infrastructure, or other threats.
 *    Based on Amazon internal threat intelligence. Free, no per-request cost.
 *
 * 4. **Known Bad Inputs** (priority 4) — blocks request patterns associated
 *    with vulnerability exploitation (e.g. Log4j/Log4Shell patterns, Java
 *    deserialization). Free, low overhead.
 *
 * 5. **Core Rule Set** (priority 5) — protects against common web exploits
 *    (SQL injection, XSS, etc.). Evaluated last among free rules because
 *    it has the broadest matching and highest false-positive potential.
 *
 * Default action is ALLOW — only matched rules trigger blocks.
 *
 * Cost note: Bot Control has per-request charges. It is placed first because
 * the alternative (rate-limiting verified crawlers) is functionally broken.
 * For a redirect service with aggressive CloudFront caching, the actual
 * request volume reaching WAF is low after cache warm-up.
 */
export class RedirectWaf extends Construct {
  /** The WAF WebACL resource. Use `webAcl.attrArn` to associate with CloudFront. */
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: RedirectWafProps) {
    super(scope, id);

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${id}-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Priority 1: Bot Control — must run first to label verified crawlers
        // before rate limiting is evaluated. Without this, Googlebot/Bingbot
        // would be blocked by the rate limit during aggressive re-indexing crawls.
        {
          name: 'AWSManagedRulesBotControlRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesBotControlRuleSet',
              managedRuleGroupConfigs: [
                {
                  awsManagedRulesBotControlRuleSet: {
                    inspectionLevel: 'COMMON',
                  },
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${id}-bot-control`,
            sampledRequestsEnabled: true,
          },
        },

        // Priority 2: Rate Limit — blocks IPs exceeding threshold.
        // Scope-down excludes verified bots (labelled by Bot Control above).
        // This ensures crawlers like Googlebot can crawl aggressively during
        // re-indexing without being blocked, while still protecting against
        // volumetric abuse from unverified sources.
        {
          name: 'RateLimit',
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: props.rateLimitPerIp ?? 100,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                notStatement: {
                  statement: {
                    labelMatchStatement: {
                      scope: 'LABEL',
                      key: 'awswaf:managed:aws:bot-control:bot:verified',
                    },
                  },
                },
              },
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${id}-rate-limit`,
            sampledRequestsEnabled: true,
          },
        },

        // Priority 3: IP Reputation — blocks known-malicious IPs based on
        // Amazon internal threat intelligence. Free, no per-request cost.
        // Catches IPs associated with botnets, C2 servers, and known attackers.
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${id}-ip-reputation`,
            sampledRequestsEnabled: true,
          },
        },

        // Priority 4: Known Bad Inputs — blocks request patterns associated
        // with vulnerability exploitation (Log4j, Java deserialization, etc.).
        // Free, low overhead. Catches exploit attempts early.
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${id}-known-bad-inputs`,
            sampledRequestsEnabled: true,
          },
        },

        // Priority 5: Core Rule Set — broad protection against common web
        // exploits (SQLi, XSS, path traversal). Evaluated last among free
        // rules as it has the widest matching criteria.
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 5,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${id}-common-rules`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
  }
}
