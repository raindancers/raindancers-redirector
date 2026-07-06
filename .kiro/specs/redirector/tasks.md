# URL Redirect Service — Tasks

## Phase 1: Core Infrastructure (CDK Construct)

### TASK-1: Scaffold `raindancers-redirector` project
- [ ] Initialise CDK construct library project (TypeScript, projen or manual)
- [ ] Set up jest for unit tests
- [ ] Set up eslint + prettier
- [ ] Create `src/redirect-service.ts` with empty `RedirectService` construct class
- [ ] Create `src/index.ts` barrel export
- [ ] Verify `npm run build` and `npm test` pass

### TASK-2: DynamoDB table
- [ ] Create DynamoDB table construct (on-demand billing, us-east-1)
- [ ] Partition key: `pk` (String)
- [ ] Enable DynamoDB Streams (NEW_AND_OLD_IMAGES)
- [ ] Encryption: AWS-managed key
- [ ] Point-in-time recovery enabled
- [ ] Removal policy: RETAIN for production

### TASK-3: Lambda@Edge — redirect handler
- [ ] Create Python 3.12 Lambda function (us-east-1)
- [ ] Package with boto3 (included in Lambda runtime)
- [ ] Implement Phase 1: URL normalisation
- [ ] Implement Phase 2: Exact match (DynamoDB GetItem)
- [ ] Implement Phase 3: Pattern match (DynamoDB Query)
- [ ] Implement Phase 4: Fallback lookup
- [ ] Implement response builder (301/302/410/404 with security headers)
- [ ] IAM role: `dynamodb:GetItem`, `dynamodb:Query` on redirects table only
- [ ] Wire as CloudFront viewer-request function
- [ ] Memory: 128 MB, Timeout: 5 seconds

### TASK-4: CloudFront distribution
- [ ] Create distribution with no default origin (Lambda@Edge handles all)
- [ ] Accept `brands[].sourceDomains` as aliases
- [ ] ACM certificate (us-east-1) with all legacy domains as SANs
- [ ] Custom cache policy: cache by Host + URI + query string
- [ ] Cache TTL: 90 days for 301/302, 0 for 404/410
- [ ] Viewer protocol policy: redirect HTTP → HTTPS
- [ ] Associate Lambda@Edge on viewer-request
- [ ] Response headers: HSTS, X-Content-Type-Options, X-Frame-Options

### TASK-5: WAF
- [ ] Create WAF WebACL (us-east-1, CLOUDFRONT scope)
- [ ] Rate-based rule: configurable per-IP limit (default 1000/5min)
- [ ] AWS Managed Rules: Core Rule Set
- [ ] AWS Managed Rules: Bot Control (allow verified crawlers)
- [ ] Associate with CloudFront distribution

## Phase 2: Data Management

### TASK-6: S3 import bucket
- [ ] Create S3 bucket for CSV uploads
- [ ] Enable versioning
- [ ] Lifecycle rule: delete old versions after 30 days
- [ ] Block public access

### TASK-7: CSV Loader Lambda
- [ ] Create Python 3.12 Lambda (512 MB, 5 min timeout)
- [ ] Trigger on S3 ObjectCreated (`.csv` suffix)
- [ ] Parse CSV: `source_domain,source_path,target_url,status_code`
- [ ] Apply path normalisation (same rules as Lambda@Edge Phase 1)
- [ ] Validate: target URL reachability (HEAD request, expect 2xx)
- [ ] Validate: no redirect loops (target host ≠ source domain)
- [ ] DynamoDB BatchWriteItem (25 per batch, exponential backoff)
- [ ] Write errors to S3 `/errors/{filename}-{timestamp}.csv`
- [ ] Log summary to CloudWatch (total, written, skipped, errors)
- [ ] IAM: `dynamodb:BatchWriteItem`, `s3:GetObject`, `s3:PutObject`

### TASK-8: Invalidation Lambda
- [ ] Create Python 3.12 Lambda (128 MB, 30s timeout)
- [ ] Trigger on DynamoDB Stream events (MODIFY, REMOVE)
- [ ] Exact-match changes: invalidate specific path
- [ ] Pattern/fallback changes: invalidate `/*` (full)
- [ ] IAM: DynamoDB Streams read + `cloudfront:CreateInvalidation`

## Phase 3: Monitoring & Alerting

### TASK-9: CloudWatch monitoring
- [ ] CloudFront standard logging to S3
- [ ] Metric filter on CloudFront logs: 404 responses → `RedirectMiss` metric
- [ ] CloudWatch Alarm: `RedirectMiss` > 50 in 5 minutes
- [ ] Lambda@Edge error metric alarm (> 0 in 1 min)
- [ ] DynamoDB throttle alarm (> 0 in 1 min)
- [ ] Optional SNS topic for alerts (passed via props)

## Phase 4: Testing

### TASK-10: Unit tests
- [ ] Normalisation: all rules (www, lowercase, slash, html, index, params)
- [ ] Normalisation: combined rules in single pass
- [ ] Exact match: hit, miss, 410
- [ ] Pattern match: regex, capture groups, priority order, fallback
- [ ] Fallback: configured, not configured
- [ ] Response builder: 301, 302, 410, 404, query string merge
- [ ] CSV validation: valid rows, loops, unreachable targets, normalisation

### TASK-11: Integration tests
- [ ] DynamoDB local: full lookup flow (normalise → exact → pattern → fallback)
- [ ] CSV import: upload file, verify DynamoDB entries
- [ ] Invalidation: modify entry, verify invalidation called

### TASK-12: Construct integration tests
- [ ] Snapshot test: verify synthesised CloudFormation template is stable
- [ ] Construct instantiation with minimal props
- [ ] Construct instantiation with all optional props
- [ ] Verify Lambda@Edge association on distribution
- [ ] Verify DynamoDB Stream wired to invalidation Lambda
- [ ] Verify S3 event triggers CSV loader Lambda

## Out of Scope (handled by consuming CDK app)

The following tasks are not part of this construct library. They are the responsibility of the consuming CDK app in the DNS/shared-services account.

- CDK app that consumes `RedirectService` construct
- DNS cutover for legacy domains
- Initial CSV data load
- Acceptance testing against live infrastructure

## Dependencies Between Tasks

```
TASK-1 (scaffold)
  └─→ TASK-2 (DynamoDB)
  └─→ TASK-3 (Lambda@Edge) ← depends on TASK-2
  └─→ TASK-4 (CloudFront) ← depends on TASK-3
  └─→ TASK-5 (WAF) ← depends on TASK-4
  └─→ TASK-6 (S3 bucket)
  └─→ TASK-7 (CSV Loader) ← depends on TASK-2, TASK-6
  └─→ TASK-8 (Invalidation) ← depends on TASK-2, TASK-4
  └─→ TASK-9 (Monitoring) ← depends on TASK-4
  └─→ TASK-10 (Unit tests) ← parallel with TASK-3
  └─→ TASK-11 (Integration) ← depends on TASK-3, TASK-7, TASK-8
  └─→ TASK-12 (Construct tests) ← depends on all Phase 1-3
```

## Estimates

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Core Infrastructure | TASK-1 to TASK-5 | 2-3 days |
| Phase 2: Data Management | TASK-6 to TASK-8 | 1-2 days |
| Phase 3: Monitoring | TASK-9 | 0.5 day |
| Phase 4: Testing | TASK-10 to TASK-12 | 1-2 days |
| **Total** | | **5-7 days** |
