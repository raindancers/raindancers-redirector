# URL Redirect Service — Requirements

## Overview

A reusable, multi-domain URL redirect service that handles legacy domain redirects (e.g. `domainA.co.uk/old-path` → `domainA.com/uk/new-path`). Operates at the CloudFront edge via Lambda@Edge with DynamoDB as the redirect lookup store. Built as a standalone construct in `raindancers-redirector`, deployed to the BWIP DNS/shared-services account.

## Context

BWIP brands are migrating from country-specific domains (`.co.uk`, `.co.nz`) to consolidated `.com` domains with country-code path prefixes. Legacy URLs must be permanently redirected for SEO preservation, bookmarks, and inbound links. The service must handle multiple brands from a single deployment with no code changes required to add/update redirects.

## Requirements

### REQ-1: Exact-Path Redirect Matching
**User Story:** As a site admin, I want legacy URLs to redirect to specific new URLs so that SEO link equity and bookmarks are preserved.

**Acceptance Criteria:**
- Given a request for a legacy domain + path that has an exact-match entry in DynamoDB, the service returns a redirect to the configured target URL
- Given a request with no matching entry, the service falls through to pattern matching
- Lookup key is `{source_domain}#{normalised_path}` — composite key supporting multi-domain
- Response includes the configured HTTP status code (301, 302, or 410)
- For 410 (Gone) responses, no redirect target is returned — the response body indicates the resource has been permanently removed

### REQ-2: Pattern-Match Redirect
**User Story:** As a site admin, I want to define regex patterns that catch entire classes of legacy URLs so I don't need individual entries for thousands of URLs.

**Acceptance Criteria:**
- Given no exact match, the service evaluates pattern entries for the domain in priority order
- Patterns are regex strings stored in DynamoDB with a priority number determining evaluation order
- Patterns support capture group substitution in target URLs (e.g. `/blog/(.*)` → `/uk/blog/$1`)
- Pattern entries can optionally specify a fallback target if the substituted URL would 404
- Patterns are data managed in DynamoDB — no code changes or deployments to add/modify patterns

### REQ-3: URL Normalisation
**User Story:** As a user, I want URL variants (trailing slash, uppercase, www prefix) to resolve in a single redirect hop rather than creating redirect chains.

**Acceptance Criteria:**
- All normalisation rules are applied before lookup and combined into a single 301 response
- Rules: force HTTPS, strip www, lowercase path, strip trailing slash, collapse double slashes, strip `.html` suffix, strip `index.php`/`index.html`
- Faceted/sort query params (`manufacturer`, `limit`, `orderby`) are dropped
- Tracking params (`utm_*`, `fbclid`, `gclid`) are preserved (target site handles canonical tags)
- No redirect chains — normalisation + redirect lookup result in ONE hop maximum

### REQ-4: Multi-Domain Support
**User Story:** As a platform owner, I want a single deployment to handle redirects for all legacy domains across all brands.

**Acceptance Criteria:**
- One CloudFront distribution serves all legacy domains via a multi-SAN ACM certificate
- DynamoDB entries are keyed by domain — each domain's redirects are independent
- Adding a new brand requires only: add domain to certificate, update DNS, load CSV data
- No code changes or Lambda redeployment to onboard a new brand

### REQ-5: Configurable Fallback
**User Story:** As a site admin, I want unmatched paths to redirect to a default URL (e.g. homepage) rather than showing a broken page.

**Acceptance Criteria:**
- Each domain can have an optional fallback entry in DynamoDB
- If no exact match and no pattern match, and a fallback exists, redirect to the fallback URL
- If no fallback exists, return 404
- All unmatched paths (pre-fallback) are logged to CloudWatch for review

### REQ-6: Query String Preservation
**User Story:** As a user, I want my query parameters preserved through the redirect so links with tracking or filters still work.

**Acceptance Criteria:**
- Original query string is appended to the redirect target URL
- If the target URL already has query params, they are merged with `&`
- Faceted/sort params identified in normalisation rules are excluded from preservation

### REQ-7: CSV Bulk Import
**User Story:** As a site admin, I want to load redirect mappings from a CSV file so I can import hundreds of entries at once.

**Acceptance Criteria:**
- CSV files uploaded to a designated S3 bucket trigger automatic processing
- CSV format: `source_domain,source_path,target_url,status_code`
- Loader Lambda validates entries: normalises paths, checks target URL reachability (HTTP 200), rejects redirect loops (target host ≠ source domain)
- Valid entries are batch-written to DynamoDB (idempotent upsert)
- Invalid/skipped rows are written to `/errors/{filename}-{timestamp}.csv` with reasons
- Re-running the same file updates existing entries (idempotent)

### REQ-8: Cache with Auto-Invalidation
**User Story:** As a site admin, I want redirect corrections to take effect quickly without manual cache purges.

**Acceptance Criteria:**
- 301 responses are cached at CloudFront edge with a long TTL (90 days)
- When a DynamoDB entry is modified or deleted, a DynamoDB Stream triggers a Lambda that invalidates the specific CloudFront path
- Updated redirects take effect within seconds of the DynamoDB change
- No manual cache invalidation required for routine changes

### REQ-9: Monitoring and Alerting
**User Story:** As an operator, I want visibility into redirect misses so I can identify missing entries that need to be added.

**Acceptance Criteria:**
- All requests logged via CloudFront standard/real-time logs (cached responses included)
- CloudWatch metric filter for 404 responses from this distribution → `RedirectMiss` metric
- CloudWatch Alarm when `RedirectMiss` exceeds threshold (e.g. >50 in 5 minutes)
- Unmatched paths logged with host + path for periodic review

### REQ-10: Security
**User Story:** As an operator, I want the redirect service hardened against abuse.

**Acceptance Criteria:**
- AWS WAF attached: rate limiting (per-IP), Core Rule Set, Bot Control (allow verified crawlers)
- TLS only — HTTP → HTTPS enforced at CloudFront viewer protocol policy
- No origin server — Lambda@Edge handles everything at the edge
- Security headers on all responses: HSTS, X-Content-Type-Options, X-Frame-Options
- DynamoDB encrypted at rest, IAM-only access
- Lambda@Edge has minimal IAM (DynamoDB read-only)
- Redirect loop protection: target URLs validated against source domains

### REQ-11: Production Only
**User Story:** As a developer, I don't want to maintain redirect infrastructure in dev/staging since legacy domains only exist in production.

**Acceptance Criteria:**
- Service is deployed to production (DNS/shared-services account) only
- No dev/staging resources created
- Testing is done via unit tests and integration tests against a local/test DynamoDB table

### REQ-12: Standalone Reusable Construct
**User Story:** As a platform engineer, I want the redirect service to be a reusable CDK construct that any BWIP brand can deploy without forking code.

**Acceptance Criteria:**
- Built as a construct in `raindancers-redirector` (separate repository/project)
- Consumed by a thin CDK app in the DNS account
- Configuration-driven brand onboarding via props
- CDK manages certificate SANs, CloudFront CNAMEs, fallback entries, and initial CSV import

## Out of Scope

- Admin UI for managing redirects (future — DynamoDB console/CLI for now)
- Wildcard/glob matching (regex patterns cover this via REQ-2)
- Dev/staging deployment
- A/B testing or traffic splitting
- Analytics dashboard (CloudWatch + logs for now)

## Dependencies

- `raindancers-redirector` — Existing construct to extend
- ACM certificate in us-east-1 with legacy domain SANs
- DNS control over legacy domains
- DynamoDB in us-east-1 (co-located with Lambda@Edge)

## Related Issues

- #800 — Original issue for this feature
- #575 — Geo-based URL rewrite (separate concern)
