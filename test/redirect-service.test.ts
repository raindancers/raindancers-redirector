import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RedirectService, NormalisationRule } from '../src';

describe('RedirectService', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
  });

  describe('construct validation', () => {
    test('throws if no source domains provided', () => {
      expect(() => {
        new RedirectService(stack, 'Redirects', {
          sourceDomains: [],
        });
      }).toThrow('At least one source domain must be configured');
    });

    test('throws if DROP_FACETED_PARAMS used without params', () => {
      expect(() => {
        new RedirectService(stack, 'Redirects', {
          sourceDomains: [{ domain: 'example.co.uk' }],
          normalisationRules: [{ rule: NormalisationRule.DROP_FACETED_PARAMS }],
        });
      }).toThrow('params must be provided for DROP_FACETED_PARAMS rule');
    });

    test('throws if DROP_TRACKING_PARAMS used without params', () => {
      expect(() => {
        new RedirectService(stack, 'Redirects', {
          sourceDomains: [{ domain: 'example.co.uk' }],
          normalisationRules: [{ rule: NormalisationRule.DROP_TRACKING_PARAMS }],
        });
      }).toThrow('params must be provided for DROP_TRACKING_PARAMS rule');
    });
  });

  describe('DynamoDB table', () => {
    test('creates table with correct configuration', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      });
    });

    test('table has RETAIN deletion policy', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });

  describe('redirect handler Lambda', () => {
    test('creates Lambda with Python 3.12 runtime', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'python3.12',
        Handler: 'index.handler',
        MemorySize: 128,
        Timeout: 5,
      });
    });

    test('Lambda has TABLE_NAME environment variable', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler',
        MemorySize: 128,
        Environment: {
          Variables: Match.objectLike({
            TABLE_NAME: Match.anyValue(),
          }),
        },
      });
    });

    test('creates Function URL with AWS_IAM auth', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Url', {
        AuthType: 'AWS_IAM',
      });
    });
  });

  describe('CloudFront distribution', () => {
    test('creates distribution with domain aliases (apex + wildcard)', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [
          { domain: 'example.co.uk' },
          { domain: 'example.co.nz' },
        ],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Aliases: Match.arrayWith([
            'example.co.uk',
            '*.example.co.uk',
            'example.co.nz',
            '*.example.co.nz',
          ]),
          ViewerCertificate: Match.objectLike({
            SslSupportMethod: 'sni-only',
          }),
        }),
      });
    });

    test('distribution has redirect-to-https viewer protocol', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        }),
      });
    });
  });

  describe('ACM certificate', () => {
    test('creates certificate with apex and wildcard SANs', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [
          { domain: 'example.co.uk' },
          { domain: 'example.co.nz' },
        ],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'example.co.uk',
        SubjectAlternativeNames: Match.arrayWith([
          '*.example.co.uk',
          'example.co.nz',
          '*.example.co.nz',
        ]),
        ValidationMethod: 'DNS',
      });
    });
  });

  describe('WAF', () => {
    test('creates WebACL with CLOUDFRONT scope', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Scope: 'CLOUDFRONT',
        DefaultAction: { Allow: {} },
      });
    });

    test('WAF has rate-based rule with default limit', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimit',
            Statement: {
              RateBasedStatement: Match.objectLike({
                Limit: 100,
                AggregateKeyType: 'IP',
              }),
            },
          }),
        ]),
      });
    });

    test('WAF has configurable rate limit', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
        rateLimitPerIp: 500,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimit',
            Statement: {
              RateBasedStatement: Match.objectLike({
                Limit: 500,
                AggregateKeyType: 'IP',
              }),
            },
          }),
        ]),
      });
    });

    test('WAF rate limit excludes verified bots via scope-down', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimit',
            Statement: {
              RateBasedStatement: Match.objectLike({
                ScopeDownStatement: {
                  NotStatement: {
                    Statement: {
                      LabelMatchStatement: {
                        Scope: 'LABEL',
                        Key: 'awswaf:managed:aws:bot-control:bot:verified',
                      },
                    },
                  },
                },
              }),
            },
          }),
        ]),
      });
    });

    test('WAF Bot Control runs before rate limit (lower priority number)', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesBotControlRuleSet',
            Priority: 1,
          }),
          Match.objectLike({
            Name: 'RateLimit',
            Priority: 2,
          }),
        ]),
      });
    });

    test('WAF includes IP Reputation and Known Bad Inputs', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesAmazonIpReputationList',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesAmazonIpReputationList',
              },
            },
          }),
          Match.objectLike({
            Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
          }),
        ]),
      });
    });

    test('WAF includes Core Rule Set', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesCommonRuleSet',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesCommonRuleSet',
              },
            },
          }),
        ]),
      });
    });
  });

  describe('S3 import bucket', () => {
    test('creates versioned bucket with public access blocked', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: { Status: 'Enabled' },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });
  });

  describe('CSV loader Lambda', () => {
    test('creates Lambda with Python 3.12, 512MB, 5min timeout', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'python3.12',
        MemorySize: 512,
        Timeout: 300,
      });
    });
  });

  describe('invalidation Lambda', () => {
    test('creates Lambda with Python 3.12, 128MB, 30s timeout', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'python3.12',
        MemorySize: 128,
        Timeout: 30,
      });
    });

    test('invalidation Lambda has DynamoDB stream event source', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        EventSourceArn: Match.anyValue(),
        BatchSize: 25,
      });
    });
  });

  describe('CloudWatch alarms', () => {
    test('creates redirect handler error alarm', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 0,
      });
    });

    test('creates DynamoDB throttle alarm', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 0,
        AlarmDescription: 'DynamoDB throttling detected on redirects table',
      });
    });
  });

  describe('Route 53 records', () => {
    test('creates A records for apex and wildcard', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [{ domain: 'example.co.uk' }],
      });

      const template = Template.fromStack(stack);

      const records = template.findResources('AWS::Route53::RecordSet', {
        Properties: {
          Type: 'A',
        },
      });

      expect(Object.keys(records).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('fallback seeder', () => {
    test('creates custom resource when fallbackUrl is configured', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [
          { domain: 'example.co.uk', fallbackUrl: 'https://example.com/uk' },
        ],
      });

      const template = Template.fromStack(stack);

      // Custom resource provider Lambda exists
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'python3.12',
        Timeout: 30,
        Environment: {
          Variables: Match.objectLike({
            FALLBACK_ENTRIES: Match.anyValue(),
          }),
        },
      });
    });

    test('does not create custom resource when no fallbackUrl configured', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [
          { domain: 'example.co.uk' },
        ],
      });

      const template = Template.fromStack(stack);

      // Should not have FALLBACK_ENTRIES env var on any Lambda
      const functions = template.findResources('AWS::Lambda::Function');
      const hasFallbackEntries = Object.values(functions).some((fn: any) =>
        fn.Properties?.Environment?.Variables?.FALLBACK_ENTRIES !== undefined,
      );
      expect(hasFallbackEntries).toBe(false);
    });
  });

  describe('multiple domains', () => {
    test('handles multiple domains with different fallbacks', () => {
      new RedirectService(stack, 'Redirects', {
        sourceDomains: [
          { domain: 'brandA.co.uk', fallbackUrl: 'https://brandA.com/uk' },
          { domain: 'brandA.co.nz', fallbackUrl: 'https://brandA.com/nz' },
          { domain: 'brandB.com.au' },
        ],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Aliases: Match.arrayWith([
            'brandA.co.uk',
            '*.brandA.co.uk',
            'brandA.co.nz',
            '*.brandA.co.nz',
            'brandB.com.au',
            '*.brandB.com.au',
          ]),
        }),
      });
    });
  });
});
