# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### CsvImport <a name="CsvImport" id="raindancers-redirector.CsvImport"></a>

S3 bucket and CSV loader Lambda for bulk-importing redirect rules.

Creates:
- A versioned S3 bucket (public access blocked, 30-day noncurrent version expiry)
- A Python 3.12 Lambda triggered by `ObjectCreated` events on `imports/*.csv`

The CSV loader:
- Validates each row (domain in allowed list, no loops, target reachable)
- Checks for duplicate entries in DynamoDB before writing
- Applies normalisation rules to paths (matching the redirect handler)
- Batch writes valid entries to DynamoDB
- Writes a JSON log to `logs/{filename}-{timestamp}.json`
- Writes error rows to `errors/{filename}-{timestamp}.csv`

Upload CSVs to `imports/` prefix only — other prefixes do not trigger processing.

*Example*

```typescript
const csvImport = new CsvImport(this, 'Import', {
  table: myTable,
  allowedDomains: ['example.co.uk', 'example.co.nz'],
  enforceNoRedirectChains: true,
  normalisationRules: [NormalisationRule.LOWERCASE_PATH],
  dropQueryParams: [],
  dropTrackingParams: [],
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.CsvImport.Initializer"></a>

```typescript
import { CsvImport } from 'raindancers-redirector'

new CsvImport(scope: Construct, id: string, props: CsvImportProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.CsvImport.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.CsvImport.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.CsvImport.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.CsvImportProps">CsvImportProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.CsvImport.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.CsvImport.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.CsvImport.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.CsvImportProps">CsvImportProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.CsvImport.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.CsvImport.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.CsvImport.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.CsvImport.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.CsvImport.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.CsvImport.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.CsvImport.isConstruct"></a>

```typescript
import { CsvImport } from 'raindancers-redirector'

CsvImport.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.CsvImport.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.CsvImport.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.CsvImport.property.bucket">bucket</a></code> | <code>aws-cdk-lib.aws_s3.Bucket</code> | The S3 bucket for CSV imports, logs, and errors. |
| <code><a href="#raindancers-redirector.CsvImport.property.loader">loader</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The CSV loader Lambda function. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.CsvImport.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `bucket`<sup>Required</sup> <a name="bucket" id="raindancers-redirector.CsvImport.property.bucket"></a>

```typescript
public readonly bucket: Bucket;
```

- *Type:* aws-cdk-lib.aws_s3.Bucket

The S3 bucket for CSV imports, logs, and errors.

---

##### `loader`<sup>Required</sup> <a name="loader" id="raindancers-redirector.CsvImport.property.loader"></a>

```typescript
public readonly loader: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The CSV loader Lambda function.

---


### FallbackSeeder <a name="FallbackSeeder" id="raindancers-redirector.FallbackSeeder"></a>

Custom resource that seeds `__fallback__` entries in DynamoDB at deploy time.

For each source domain that has a `fallbackUrl` configured, writes an entry
with key `{domain}#__fallback__` to the redirects table. This entry is used
by the redirect handler as the last-resort redirect when no exact or pattern
match is found.

Behaviour by CloudFormation event:
- **Create/Update**: writes (upserts) all fallback entries
- **Delete**: removes all fallback entries

If no source domains have `fallbackUrl` set, this construct creates no resources.

*Example*

```typescript
new FallbackSeeder(this, 'Seeder', {
  table: redirectsTable,
  sourceDomains: [
    { domain: 'example.co.uk', fallbackUrl: 'https://example.com/uk' },
    { domain: 'example.co.nz' },  // no fallback — skipped
  ],
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.FallbackSeeder.Initializer"></a>

```typescript
import { FallbackSeeder } from 'raindancers-redirector'

new FallbackSeeder(scope: Construct, id: string, props: FallbackSeederProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.FallbackSeeder.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.FallbackSeeder.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.FallbackSeeder.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.FallbackSeederProps">FallbackSeederProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.FallbackSeeder.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.FallbackSeeder.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.FallbackSeeder.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.FallbackSeederProps">FallbackSeederProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.FallbackSeeder.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.FallbackSeeder.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.FallbackSeeder.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.FallbackSeeder.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.FallbackSeeder.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.FallbackSeeder.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.FallbackSeeder.isConstruct"></a>

```typescript
import { FallbackSeeder } from 'raindancers-redirector'

FallbackSeeder.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.FallbackSeeder.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.FallbackSeeder.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.FallbackSeeder.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


### Invalidation <a name="Invalidation" id="raindancers-redirector.Invalidation"></a>

Lambda function that invalidates CloudFront cache when DynamoDB entries change.

Triggered by DynamoDB Streams on MODIFY and REMOVE events. Determines the
invalidation strategy based on the entry type:

- **Exact-match entries** (`{domain}#{path}`): invalidates the specific path
- **Pattern or fallback entries** (`__pattern__` or `__fallback__` in key):
  triggers a full invalidation (`/*`) since any cached path could be affected

Configuration:
- Runtime: Python 3.12
- Memory: 128 MB
- Timeout: 30 seconds
- Batch size: 25 records per invocation
- Retry attempts: 3
- Event filter: MODIFY and REMOVE only (INSERT events don't need invalidation
  since there's nothing cached for new entries)

IAM permissions:
- DynamoDB Streams read (via event source)
- `cloudfront:CreateInvalidation` on the target distribution

*Example*

```typescript
const invalidation = new Invalidation(this, 'Invalidation', {
  table: redirectsTable,
  distribution: cfDistribution,
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.Invalidation.Initializer"></a>

```typescript
import { Invalidation } from 'raindancers-redirector'

new Invalidation(scope: Construct, id: string, props: InvalidationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.Invalidation.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.Invalidation.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.Invalidation.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.InvalidationProps">InvalidationProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.Invalidation.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.Invalidation.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.Invalidation.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.InvalidationProps">InvalidationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.Invalidation.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.Invalidation.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.Invalidation.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.Invalidation.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.Invalidation.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.Invalidation.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.Invalidation.isConstruct"></a>

```typescript
import { Invalidation } from 'raindancers-redirector'

Invalidation.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.Invalidation.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.Invalidation.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.Invalidation.property.deadLetterQueue">deadLetterQueue</a></code> | <code>aws-cdk-lib.aws_sqs.Queue</code> | Dead-letter queue for failed DynamoDB Stream events. |
| <code><a href="#raindancers-redirector.Invalidation.property.handler">handler</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The invalidation Lambda function resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.Invalidation.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `deadLetterQueue`<sup>Required</sup> <a name="deadLetterQueue" id="raindancers-redirector.Invalidation.property.deadLetterQueue"></a>

```typescript
public readonly deadLetterQueue: Queue;
```

- *Type:* aws-cdk-lib.aws_sqs.Queue

Dead-letter queue for failed DynamoDB Stream events.

---

##### `handler`<sup>Required</sup> <a name="handler" id="raindancers-redirector.Invalidation.property.handler"></a>

```typescript
public readonly handler: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The invalidation Lambda function resource.

---


### Monitoring <a name="Monitoring" id="raindancers-redirector.Monitoring"></a>

CloudWatch alarms for the redirect service.

Creates three alarms:

1. **Redirect handler errors** — fires when the redirect handler Lambda
   has any errors in a 1-minute period. Indicates lookup failures that
   result in 5xx responses to users.

2. **DynamoDB throttles** — fires when the redirects table throttles any
   operation (GetItem, Query, PutItem, BatchWriteItem) in a 1-minute period.
   Indicates capacity issues (unlikely with on-demand billing unless there's
   a sudden extreme burst).

3. **Invalidation handler errors** — fires when the invalidation Lambda
   has any errors in a 5-minute period. Indicates cache invalidation failures
   which mean stale redirects may be served.

All alarms use `GreaterThanThreshold` with threshold 0 — any error triggers.
When an `alertTopic` is provided, all three alarms send ALARM notifications.

*Example*

```typescript
new Monitoring(this, 'Monitoring', {
  redirectHandler: handler.handler,
  invalidationHandler: invalidation.handler,
  table: table.table,
  alertTopic: myTopic,
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.Monitoring.Initializer"></a>

```typescript
import { Monitoring } from 'raindancers-redirector'

new Monitoring(scope: Construct, id: string, props: MonitoringProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.Monitoring.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.Monitoring.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.Monitoring.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.MonitoringProps">MonitoringProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.Monitoring.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.Monitoring.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.Monitoring.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.MonitoringProps">MonitoringProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.Monitoring.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.Monitoring.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.Monitoring.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.Monitoring.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.Monitoring.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.Monitoring.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.Monitoring.isConstruct"></a>

```typescript
import { Monitoring } from 'raindancers-redirector'

Monitoring.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.Monitoring.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.Monitoring.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.Monitoring.property.invalidationErrorAlarm">invalidationErrorAlarm</a></code> | <code>aws-cdk-lib.aws_cloudwatch.Alarm</code> | Alarm that fires on invalidation Lambda errors. |
| <code><a href="#raindancers-redirector.Monitoring.property.redirectErrorAlarm">redirectErrorAlarm</a></code> | <code>aws-cdk-lib.aws_cloudwatch.Alarm</code> | Alarm that fires on redirect handler Lambda errors. |
| <code><a href="#raindancers-redirector.Monitoring.property.throttleAlarm">throttleAlarm</a></code> | <code>aws-cdk-lib.aws_cloudwatch.Alarm</code> | Alarm that fires on DynamoDB throttles. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.Monitoring.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `invalidationErrorAlarm`<sup>Required</sup> <a name="invalidationErrorAlarm" id="raindancers-redirector.Monitoring.property.invalidationErrorAlarm"></a>

```typescript
public readonly invalidationErrorAlarm: Alarm;
```

- *Type:* aws-cdk-lib.aws_cloudwatch.Alarm

Alarm that fires on invalidation Lambda errors.

---

##### `redirectErrorAlarm`<sup>Required</sup> <a name="redirectErrorAlarm" id="raindancers-redirector.Monitoring.property.redirectErrorAlarm"></a>

```typescript
public readonly redirectErrorAlarm: Alarm;
```

- *Type:* aws-cdk-lib.aws_cloudwatch.Alarm

Alarm that fires on redirect handler Lambda errors.

---

##### `throttleAlarm`<sup>Required</sup> <a name="throttleAlarm" id="raindancers-redirector.Monitoring.property.throttleAlarm"></a>

```typescript
public readonly throttleAlarm: Alarm;
```

- *Type:* aws-cdk-lib.aws_cloudwatch.Alarm

Alarm that fires on DynamoDB throttles.

---


### RedirectDistribution <a name="RedirectDistribution" id="raindancers-redirector.RedirectDistribution"></a>

CloudFront distribution with ACM certificate, Route 53 records, and WAF.

Creates:
- ACM certificate with apex + wildcard SANs for all source domains, DNS-validated
  via Route 53 hosted zones in the same account
- CloudFront distribution with:
  - Lambda Function URL origin (Origin Access Control)
  - Custom cache policy (Host + URI + query string as cache key)
  - Security response headers (HSTS, X-Content-Type-Options, X-Frame-Options)
  - WAF WebACL association
  - Redirect HTTP → HTTPS viewer protocol
- Route 53 A records (apex + wildcard) for each domain pointing to CloudFront

Cache key includes query strings because redirect targets vary by query string
(REQ-6: query params are appended to the Location header).

*Example*

```typescript
const dist = new RedirectDistribution(this, 'Dist', {
  sourceDomains: [{ domain: 'old.example.com' }],
  functionUrl: handler.functionUrl,
  webAcl: waf.webAcl,
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.RedirectDistribution.Initializer"></a>

```typescript
import { RedirectDistribution } from 'raindancers-redirector'

new RedirectDistribution(scope: Construct, id: string, props: RedirectDistributionProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectDistribution.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectDistribution.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectDistribution.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.RedirectDistributionProps">RedirectDistributionProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.RedirectDistribution.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.RedirectDistribution.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.RedirectDistribution.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.RedirectDistributionProps">RedirectDistributionProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectDistribution.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.RedirectDistribution.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.RedirectDistribution.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.RedirectDistribution.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.RedirectDistribution.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectDistribution.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.RedirectDistribution.isConstruct"></a>

```typescript
import { RedirectDistribution } from 'raindancers-redirector'

RedirectDistribution.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.RedirectDistribution.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectDistribution.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.RedirectDistribution.property.distribution">distribution</a></code> | <code>aws-cdk-lib.aws_cloudfront.Distribution</code> | The CloudFront distribution resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.RedirectDistribution.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `distribution`<sup>Required</sup> <a name="distribution" id="raindancers-redirector.RedirectDistribution.property.distribution"></a>

```typescript
public readonly distribution: Distribution;
```

- *Type:* aws-cdk-lib.aws_cloudfront.Distribution

The CloudFront distribution resource.

---


### RedirectHandler <a name="RedirectHandler" id="raindancers-redirector.RedirectHandler"></a>

Lambda function that handles URL redirect lookups.

Deployed as a Python 3.12 Lambda with a Function URL (AWS_IAM auth)
that serves as the CloudFront origin. The handler performs:

1. URL normalisation (configurable rules)
2. Exact match lookup in DynamoDB
3. Pattern match via regex entries in priority order
4. Domain-level fallback lookup
5. Returns 404 if nothing matches

Responses include security headers (HSTS, X-Content-Type-Options, X-Frame-Options)
and appropriate cache-control headers (long TTL for redirects, no-cache for 404).

The Function URL uses AWS_IAM auth — only CloudFront (via OAC) can invoke it.

*Example*

```typescript
const handler = new RedirectHandler(this, 'Handler', {
  table: myTable,
  normalisationRules: [NormalisationRule.STRIP_WWW, NormalisationRule.LOWERCASE_PATH],
  dropQueryParams: [],
  dropTrackingParams: [],
});
```


#### Initializers <a name="Initializers" id="raindancers-redirector.RedirectHandler.Initializer"></a>

```typescript
import { RedirectHandler } from 'raindancers-redirector'

new RedirectHandler(scope: Construct, id: string, props: RedirectHandlerProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectHandler.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectHandler.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectHandler.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.RedirectHandlerProps">RedirectHandlerProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.RedirectHandler.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.RedirectHandler.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.RedirectHandler.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.RedirectHandlerProps">RedirectHandlerProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectHandler.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.RedirectHandler.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.RedirectHandler.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.RedirectHandler.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.RedirectHandler.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectHandler.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.RedirectHandler.isConstruct"></a>

```typescript
import { RedirectHandler } from 'raindancers-redirector'

RedirectHandler.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.RedirectHandler.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectHandler.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.RedirectHandler.property.functionUrl">functionUrl</a></code> | <code>aws-cdk-lib.aws_lambda.FunctionUrl</code> | The Function URL resource (used as CloudFront origin). |
| <code><a href="#raindancers-redirector.RedirectHandler.property.handler">handler</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The Lambda function resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.RedirectHandler.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `functionUrl`<sup>Required</sup> <a name="functionUrl" id="raindancers-redirector.RedirectHandler.property.functionUrl"></a>

```typescript
public readonly functionUrl: FunctionUrl;
```

- *Type:* aws-cdk-lib.aws_lambda.FunctionUrl

The Function URL resource (used as CloudFront origin).

---

##### `handler`<sup>Required</sup> <a name="handler" id="raindancers-redirector.RedirectHandler.property.handler"></a>

```typescript
public readonly handler: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The Lambda function resource.

---


### RedirectService <a name="RedirectService" id="raindancers-redirector.RedirectService"></a>

A complete multi-domain URL redirect service.

Deploys CloudFront + Lambda Function URL + DynamoDB + WAF + S3 CSV import
infrastructure that handles redirect lookups at the edge with automatic
cache invalidation when rules change.

The redirect handler performs lookups in this order:
1. Normalise the URL (if rules configured)
2. Exact match in DynamoDB (`{domain}#{path}`)
3. Pattern match via regex entries in priority order
4. Domain-level fallback (`{domain}#__fallback__`)
5. Return 404 if nothing matches

*Example*

```typescript
const redirects = new RedirectService(this, 'Redirects', {
  sourceDomains: [
    { domain: 'old.example.com', fallbackUrl: 'https://new.example.com' },
  ],
});

// Access outputs
redirects.distribution;   // CloudFront distribution
redirects.table;          // DynamoDB table for direct access
redirects.importBucket;   // S3 bucket — upload CSVs to imports/ prefix
```


#### Initializers <a name="Initializers" id="raindancers-redirector.RedirectService.Initializer"></a>

```typescript
import { RedirectService } from 'raindancers-redirector'

new RedirectService(scope: Construct, id: string, props: RedirectServiceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectService.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectService.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectService.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.RedirectServiceProps">RedirectServiceProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.RedirectService.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.RedirectService.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.RedirectService.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.RedirectServiceProps">RedirectServiceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectService.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.RedirectService.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.RedirectService.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.RedirectService.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.RedirectService.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectService.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.RedirectService.isConstruct"></a>

```typescript
import { RedirectService } from 'raindancers-redirector'

RedirectService.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.RedirectService.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectService.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.RedirectService.property.distribution">distribution</a></code> | <code>aws-cdk-lib.aws_cloudfront.Distribution</code> | The CloudFront distribution serving all redirect domains. |
| <code><a href="#raindancers-redirector.RedirectService.property.importBucket">importBucket</a></code> | <code>aws-cdk-lib.aws_s3.Bucket</code> | The S3 bucket for CSV imports. |
| <code><a href="#raindancers-redirector.RedirectService.property.redirectHandler">redirectHandler</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The Lambda function handling redirect lookups. |
| <code><a href="#raindancers-redirector.RedirectService.property.redirectHandlerUrl">redirectHandlerUrl</a></code> | <code>aws-cdk-lib.aws_lambda.FunctionUrl</code> | The Function URL for the redirect handler (used as CloudFront origin). |
| <code><a href="#raindancers-redirector.RedirectService.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table storing redirect rules (exact, pattern, fallback entries). |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.RedirectService.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `distribution`<sup>Required</sup> <a name="distribution" id="raindancers-redirector.RedirectService.property.distribution"></a>

```typescript
public readonly distribution: Distribution;
```

- *Type:* aws-cdk-lib.aws_cloudfront.Distribution

The CloudFront distribution serving all redirect domains.

---

##### `importBucket`<sup>Required</sup> <a name="importBucket" id="raindancers-redirector.RedirectService.property.importBucket"></a>

```typescript
public readonly importBucket: Bucket;
```

- *Type:* aws-cdk-lib.aws_s3.Bucket

The S3 bucket for CSV imports.

Upload files to the `imports/` prefix.

---

##### `redirectHandler`<sup>Required</sup> <a name="redirectHandler" id="raindancers-redirector.RedirectService.property.redirectHandler"></a>

```typescript
public readonly redirectHandler: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The Lambda function handling redirect lookups.

---

##### `redirectHandlerUrl`<sup>Required</sup> <a name="redirectHandlerUrl" id="raindancers-redirector.RedirectService.property.redirectHandlerUrl"></a>

```typescript
public readonly redirectHandlerUrl: FunctionUrl;
```

- *Type:* aws-cdk-lib.aws_lambda.FunctionUrl

The Function URL for the redirect handler (used as CloudFront origin).

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.RedirectService.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table storing redirect rules (exact, pattern, fallback entries).

---


### RedirectsTable <a name="RedirectsTable" id="raindancers-redirector.RedirectsTable"></a>

DynamoDB table for storing redirect rules.

Uses a single-table design with a string partition key `pk`.
Key formats:
- Exact match: `{domain}#{path}` (e.g. `example.co.uk#/old-page`)
- Pattern: `{domain}#__pattern__{priority}` (e.g. `example.co.uk#__pattern__010`)
- Fallback: `{domain}#__fallback__` (e.g. `example.co.uk#__fallback__`)

Configuration:
- Billing: on-demand (pay-per-request)
- Stream: NEW_AND_OLD_IMAGES (for cache invalidation)
- Encryption: AWS-managed key
- Point-in-time recovery: enabled
- Removal policy: RETAIN (data preserved on stack deletion)

#### Initializers <a name="Initializers" id="raindancers-redirector.RedirectsTable.Initializer"></a>

```typescript
import { RedirectsTable } from 'raindancers-redirector'

new RedirectsTable(scope: Construct, id: string)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectsTable.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectsTable.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.RedirectsTable.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.RedirectsTable.Initializer.parameter.id"></a>

- *Type:* string

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectsTable.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.RedirectsTable.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.RedirectsTable.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.RedirectsTable.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.RedirectsTable.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectsTable.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.RedirectsTable.isConstruct"></a>

```typescript
import { RedirectsTable } from 'raindancers-redirector'

RedirectsTable.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.RedirectsTable.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectsTable.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.RedirectsTable.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.RedirectsTable.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.RedirectsTable.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table resource.

---


### RedirectWaf <a name="RedirectWaf" id="raindancers-redirector.RedirectWaf"></a>

WAF WebACL for the redirect service CloudFront distribution.

Creates a CLOUDFRONT-scoped WebACL with five rules in a specific order
designed to maximise protection while minimising cost and avoiding
false positives on legitimate crawlers.

Rule evaluation order (lowest priority number = evaluated first):

1. **Bot Control** (priority 1) — MUST run first so it can label verified
   crawlers (Googlebot, Bingbot, etc.) before rate limiting is evaluated.
   Without this ordering, verified crawlers would be rate-limited and blocked
   before they're identified. Uses COMMON inspection level.

2. **Rate Limit** (priority 2) — blocks IPs exceeding the configured
   threshold per 5-minute window. Includes a scope-down statement that
   EXCLUDES requests labelled as verified bots by Bot Control (priority 1).
   This ensures legitimate crawlers are never rate-limited regardless of
   how aggressively they crawl during re-indexing.

3. **IP Reputation** (priority 3) — blocks requests from IPs known to be
   associated with bots, command-and-control infrastructure, or other threats.
   Based on Amazon internal threat intelligence. Free, no per-request cost.

4. **Known Bad Inputs** (priority 4) — blocks request patterns associated
   with vulnerability exploitation (e.g. Log4j/Log4Shell patterns, Java
   deserialization). Free, low overhead.

5. **Core Rule Set** (priority 5) — protects against common web exploits
   (SQL injection, XSS, etc.). Evaluated last among free rules because
   it has the broadest matching and highest false-positive potential.

Default action is ALLOW — only matched rules trigger blocks.

Cost note: Bot Control has per-request charges. It is placed first because
the alternative (rate-limiting verified crawlers) is functionally broken.
For a redirect service with aggressive CloudFront caching, the actual
request volume reaching WAF is low after cache warm-up.

#### Initializers <a name="Initializers" id="raindancers-redirector.RedirectWaf.Initializer"></a>

```typescript
import { RedirectWaf } from 'raindancers-redirector'

new RedirectWaf(scope: Construct, id: string, props: RedirectWafProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectWaf.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectWaf.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#raindancers-redirector.RedirectWaf.Initializer.parameter.props">props</a></code> | <code><a href="#raindancers-redirector.RedirectWafProps">RedirectWafProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="raindancers-redirector.RedirectWaf.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="raindancers-redirector.RedirectWaf.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="raindancers-redirector.RedirectWaf.Initializer.parameter.props"></a>

- *Type:* <a href="#raindancers-redirector.RedirectWafProps">RedirectWafProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectWaf.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#raindancers-redirector.RedirectWaf.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="raindancers-redirector.RedirectWaf.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="raindancers-redirector.RedirectWaf.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="raindancers-redirector.RedirectWaf.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.RedirectWaf.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="raindancers-redirector.RedirectWaf.isConstruct"></a>

```typescript
import { RedirectWaf } from 'raindancers-redirector'

RedirectWaf.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="raindancers-redirector.RedirectWaf.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectWaf.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#raindancers-redirector.RedirectWaf.property.webAcl">webAcl</a></code> | <code>aws-cdk-lib.aws_wafv2.CfnWebACL</code> | The WAF WebACL resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="raindancers-redirector.RedirectWaf.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `webAcl`<sup>Required</sup> <a name="webAcl" id="raindancers-redirector.RedirectWaf.property.webAcl"></a>

```typescript
public readonly webAcl: CfnWebACL;
```

- *Type:* aws-cdk-lib.aws_wafv2.CfnWebACL

The WAF WebACL resource.

Use `webAcl.attrArn` to associate with CloudFront.

---


## Structs <a name="Structs" id="Structs"></a>

### CsvImportProps <a name="CsvImportProps" id="raindancers-redirector.CsvImportProps"></a>

Props for the {@link CsvImport} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.CsvImportProps.Initializer"></a>

```typescript
import { CsvImportProps } from 'raindancers-redirector'

const csvImportProps: CsvImportProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.CsvImportProps.property.allowedDomains">allowedDomains</a></code> | <code>string[]</code> | List of domains that are valid `source_domain` values in CSV rows. |
| <code><a href="#raindancers-redirector.CsvImportProps.property.dropQueryParams">dropQueryParams</a></code> | <code>string[]</code> | Faceted/sort query parameters to drop (when DROP_FACETED_PARAMS is in the rules). |
| <code><a href="#raindancers-redirector.CsvImportProps.property.dropTrackingParams">dropTrackingParams</a></code> | <code>string[]</code> | Tracking query parameters to drop (when DROP_TRACKING_PARAMS is in the rules). |
| <code><a href="#raindancers-redirector.CsvImportProps.property.enforceNoRedirectChains">enforceNoRedirectChains</a></code> | <code>boolean</code> | When true, rejects CSV entries where the target URL returns a 3xx redirect instead of 200 OK. |
| <code><a href="#raindancers-redirector.CsvImportProps.property.normalisationRules">normalisationRules</a></code> | <code><a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a>[]</code> | Normalisation rule names to apply to paths when building DynamoDB keys. |
| <code><a href="#raindancers-redirector.CsvImportProps.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table to write redirect entries to. |
| <code><a href="#raindancers-redirector.CsvImportProps.property.encryptionKey">encryptionKey</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | Optional KMS key for S3 bucket encryption (SSE-KMS). |

---

##### `allowedDomains`<sup>Required</sup> <a name="allowedDomains" id="raindancers-redirector.CsvImportProps.property.allowedDomains"></a>

```typescript
public readonly allowedDomains: string[];
```

- *Type:* string[]

List of domains that are valid `source_domain` values in CSV rows.

Rows with domains not in this list are rejected during import.
Typically populated from the construct's `sourceDomains` prop.

---

##### `dropQueryParams`<sup>Required</sup> <a name="dropQueryParams" id="raindancers-redirector.CsvImportProps.property.dropQueryParams"></a>

```typescript
public readonly dropQueryParams: string[];
```

- *Type:* string[]

Faceted/sort query parameters to drop (when DROP_FACETED_PARAMS is in the rules).

---

##### `dropTrackingParams`<sup>Required</sup> <a name="dropTrackingParams" id="raindancers-redirector.CsvImportProps.property.dropTrackingParams"></a>

```typescript
public readonly dropTrackingParams: string[];
```

- *Type:* string[]

Tracking query parameters to drop (when DROP_TRACKING_PARAMS is in the rules).

---

##### `enforceNoRedirectChains`<sup>Required</sup> <a name="enforceNoRedirectChains" id="raindancers-redirector.CsvImportProps.property.enforceNoRedirectChains"></a>

```typescript
public readonly enforceNoRedirectChains: boolean;
```

- *Type:* boolean

When true, rejects CSV entries where the target URL returns a 3xx redirect instead of 200 OK.

Prevents redirect chains.

---

##### `normalisationRules`<sup>Required</sup> <a name="normalisationRules" id="raindancers-redirector.CsvImportProps.property.normalisationRules"></a>

```typescript
public readonly normalisationRules: NormalisationRule[];
```

- *Type:* <a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a>[]

Normalisation rule names to apply to paths when building DynamoDB keys.

Must match the rules used by the redirect handler to ensure consistent lookup.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.CsvImportProps.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table to write redirect entries to.

---

##### `encryptionKey`<sup>Optional</sup> <a name="encryptionKey" id="raindancers-redirector.CsvImportProps.property.encryptionKey"></a>

```typescript
public readonly encryptionKey: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

Optional KMS key for S3 bucket encryption (SSE-KMS).

When omitted, the bucket uses S3-managed encryption (SSE-S3).

---

### FallbackSeederProps <a name="FallbackSeederProps" id="raindancers-redirector.FallbackSeederProps"></a>

Props for the {@link FallbackSeeder} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.FallbackSeederProps.Initializer"></a>

```typescript
import { FallbackSeederProps } from 'raindancers-redirector'

const fallbackSeederProps: FallbackSeederProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.FallbackSeederProps.property.sourceDomains">sourceDomains</a></code> | <code><a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]</code> | Source domains — only those with `fallbackUrl` set will be seeded. |
| <code><a href="#raindancers-redirector.FallbackSeederProps.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table to seed fallback entries into. |

---

##### `sourceDomains`<sup>Required</sup> <a name="sourceDomains" id="raindancers-redirector.FallbackSeederProps.property.sourceDomains"></a>

```typescript
public readonly sourceDomains: SourceDomain[];
```

- *Type:* <a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]

Source domains — only those with `fallbackUrl` set will be seeded.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.FallbackSeederProps.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table to seed fallback entries into.

---

### InvalidationProps <a name="InvalidationProps" id="raindancers-redirector.InvalidationProps"></a>

Props for the {@link Invalidation} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.InvalidationProps.Initializer"></a>

```typescript
import { InvalidationProps } from 'raindancers-redirector'

const invalidationProps: InvalidationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.InvalidationProps.property.distribution">distribution</a></code> | <code>aws-cdk-lib.aws_cloudfront.Distribution</code> | The CloudFront distribution to invalidate when entries change. |
| <code><a href="#raindancers-redirector.InvalidationProps.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table with the stream to monitor for changes. |

---

##### `distribution`<sup>Required</sup> <a name="distribution" id="raindancers-redirector.InvalidationProps.property.distribution"></a>

```typescript
public readonly distribution: Distribution;
```

- *Type:* aws-cdk-lib.aws_cloudfront.Distribution

The CloudFront distribution to invalidate when entries change.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.InvalidationProps.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table with the stream to monitor for changes.

---

### MonitoringProps <a name="MonitoringProps" id="raindancers-redirector.MonitoringProps"></a>

Props for the {@link Monitoring} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.MonitoringProps.Initializer"></a>

```typescript
import { MonitoringProps } from 'raindancers-redirector'

const monitoringProps: MonitoringProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.MonitoringProps.property.invalidationHandler">invalidationHandler</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The invalidation handler Lambda to monitor for errors. |
| <code><a href="#raindancers-redirector.MonitoringProps.property.redirectHandler">redirectHandler</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The redirect handler Lambda to monitor for errors. |
| <code><a href="#raindancers-redirector.MonitoringProps.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table to monitor for throttles. |
| <code><a href="#raindancers-redirector.MonitoringProps.property.alertTopic">alertTopic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | Optional SNS topic for alarm notifications. |

---

##### `invalidationHandler`<sup>Required</sup> <a name="invalidationHandler" id="raindancers-redirector.MonitoringProps.property.invalidationHandler"></a>

```typescript
public readonly invalidationHandler: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The invalidation handler Lambda to monitor for errors.

---

##### `redirectHandler`<sup>Required</sup> <a name="redirectHandler" id="raindancers-redirector.MonitoringProps.property.redirectHandler"></a>

```typescript
public readonly redirectHandler: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The redirect handler Lambda to monitor for errors.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.MonitoringProps.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table to monitor for throttles.

---

##### `alertTopic`<sup>Optional</sup> <a name="alertTopic" id="raindancers-redirector.MonitoringProps.property.alertTopic"></a>

```typescript
public readonly alertTopic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

Optional SNS topic for alarm notifications.

When provided, all alarms will send ALARM state notifications to this topic.

---

### NormalisationRuleConfig <a name="NormalisationRuleConfig" id="raindancers-redirector.NormalisationRuleConfig"></a>

Configuration for a single normalisation rule.

Simple rules (STRIP_WWW, LOWERCASE_PATH, etc.) only require the `rule` field.
Param-based rules (DROP_FACETED_PARAMS, DROP_TRACKING_PARAMS) additionally
require the `params` field to specify which query parameters to drop.

*Example*

```typescript
Param-based rule:

{ rule: NormalisationRule.DROP_FACETED_PARAMS, params: ['manufacturer', 'limit', 'orderby'] }
```


#### Initializer <a name="Initializer" id="raindancers-redirector.NormalisationRuleConfig.Initializer"></a>

```typescript
import { NormalisationRuleConfig } from 'raindancers-redirector'

const normalisationRuleConfig: NormalisationRuleConfig = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.NormalisationRuleConfig.property.rule">rule</a></code> | <code><a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a></code> | The normalisation rule to apply. |
| <code><a href="#raindancers-redirector.NormalisationRuleConfig.property.params">params</a></code> | <code>string[]</code> | Query parameters to drop when using DROP_FACETED_PARAMS or DROP_TRACKING_PARAMS. |

---

##### `rule`<sup>Required</sup> <a name="rule" id="raindancers-redirector.NormalisationRuleConfig.property.rule"></a>

```typescript
public readonly rule: NormalisationRule;
```

- *Type:* <a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a>

The normalisation rule to apply.

---

##### `params`<sup>Optional</sup> <a name="params" id="raindancers-redirector.NormalisationRuleConfig.property.params"></a>

```typescript
public readonly params: string[];
```

- *Type:* string[]

Query parameters to drop when using DROP_FACETED_PARAMS or DROP_TRACKING_PARAMS.

Each entry is an exact parameter name to match and remove from the query string.

Required when `rule` is `DROP_FACETED_PARAMS` or `DROP_TRACKING_PARAMS`.
Ignored for all other rules.

---

### RedirectDistributionProps <a name="RedirectDistributionProps" id="raindancers-redirector.RedirectDistributionProps"></a>

Props for the {@link RedirectDistribution} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.RedirectDistributionProps.Initializer"></a>

```typescript
import { RedirectDistributionProps } from 'raindancers-redirector'

const redirectDistributionProps: RedirectDistributionProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectDistributionProps.property.functionUrl">functionUrl</a></code> | <code>aws-cdk-lib.aws_lambda.FunctionUrl</code> | The Lambda Function URL to use as the CloudFront origin (with OAC). |
| <code><a href="#raindancers-redirector.RedirectDistributionProps.property.sourceDomains">sourceDomains</a></code> | <code><a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]</code> | Source domains — each gets apex + wildcard aliases, cert SANs, and Route 53 records. |
| <code><a href="#raindancers-redirector.RedirectDistributionProps.property.webAcl">webAcl</a></code> | <code>aws-cdk-lib.aws_wafv2.CfnWebACL</code> | The WAF WebACL to associate with the distribution. |
| <code><a href="#raindancers-redirector.RedirectDistributionProps.property.cacheTtl">cacheTtl</a></code> | <code>number</code> | Cache TTL in seconds for redirect responses (301/302). |

---

##### `functionUrl`<sup>Required</sup> <a name="functionUrl" id="raindancers-redirector.RedirectDistributionProps.property.functionUrl"></a>

```typescript
public readonly functionUrl: FunctionUrl;
```

- *Type:* aws-cdk-lib.aws_lambda.FunctionUrl

The Lambda Function URL to use as the CloudFront origin (with OAC).

---

##### `sourceDomains`<sup>Required</sup> <a name="sourceDomains" id="raindancers-redirector.RedirectDistributionProps.property.sourceDomains"></a>

```typescript
public readonly sourceDomains: SourceDomain[];
```

- *Type:* <a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]

Source domains — each gets apex + wildcard aliases, cert SANs, and Route 53 records.

---

##### `webAcl`<sup>Required</sup> <a name="webAcl" id="raindancers-redirector.RedirectDistributionProps.property.webAcl"></a>

```typescript
public readonly webAcl: CfnWebACL;
```

- *Type:* aws-cdk-lib.aws_wafv2.CfnWebACL

The WAF WebACL to associate with the distribution.

---

##### `cacheTtl`<sup>Optional</sup> <a name="cacheTtl" id="raindancers-redirector.RedirectDistributionProps.property.cacheTtl"></a>

```typescript
public readonly cacheTtl: number;
```

- *Type:* number
- *Default:* 7776000 (90 days)

Cache TTL in seconds for redirect responses (301/302).

---

### RedirectHandlerProps <a name="RedirectHandlerProps" id="raindancers-redirector.RedirectHandlerProps"></a>

Props for the {@link RedirectHandler} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.RedirectHandlerProps.Initializer"></a>

```typescript
import { RedirectHandlerProps } from 'raindancers-redirector'

const redirectHandlerProps: RedirectHandlerProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectHandlerProps.property.dropQueryParams">dropQueryParams</a></code> | <code>string[]</code> | Faceted/sort query parameters to drop when DROP_FACETED_PARAMS is enabled. |
| <code><a href="#raindancers-redirector.RedirectHandlerProps.property.dropTrackingParams">dropTrackingParams</a></code> | <code>string[]</code> | Tracking query parameters to drop when DROP_TRACKING_PARAMS is enabled. |
| <code><a href="#raindancers-redirector.RedirectHandlerProps.property.normalisationRules">normalisationRules</a></code> | <code><a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a>[]</code> | Normalisation rule names to apply before lookup. |
| <code><a href="#raindancers-redirector.RedirectHandlerProps.property.table">table</a></code> | <code>aws-cdk-lib.aws_dynamodb.Table</code> | The DynamoDB table to look up redirect rules from. |

---

##### `dropQueryParams`<sup>Required</sup> <a name="dropQueryParams" id="raindancers-redirector.RedirectHandlerProps.property.dropQueryParams"></a>

```typescript
public readonly dropQueryParams: string[];
```

- *Type:* string[]

Faceted/sort query parameters to drop when DROP_FACETED_PARAMS is enabled.

Passed to the Lambda as the DROP_QUERY_PARAMS environment variable.

---

##### `dropTrackingParams`<sup>Required</sup> <a name="dropTrackingParams" id="raindancers-redirector.RedirectHandlerProps.property.dropTrackingParams"></a>

```typescript
public readonly dropTrackingParams: string[];
```

- *Type:* string[]

Tracking query parameters to drop when DROP_TRACKING_PARAMS is enabled.

Passed to the Lambda as the DROP_TRACKING_PARAMS environment variable.

---

##### `normalisationRules`<sup>Required</sup> <a name="normalisationRules" id="raindancers-redirector.RedirectHandlerProps.property.normalisationRules"></a>

```typescript
public readonly normalisationRules: NormalisationRule[];
```

- *Type:* <a href="#raindancers-redirector.NormalisationRule">NormalisationRule</a>[]

Normalisation rule names to apply before lookup.

Passed to the Lambda as the NORMALISATION_RULES environment variable.
If empty, no normalisation is performed.

---

##### `table`<sup>Required</sup> <a name="table" id="raindancers-redirector.RedirectHandlerProps.property.table"></a>

```typescript
public readonly table: Table;
```

- *Type:* aws-cdk-lib.aws_dynamodb.Table

The DynamoDB table to look up redirect rules from.

---

### RedirectServiceProps <a name="RedirectServiceProps" id="raindancers-redirector.RedirectServiceProps"></a>

Props for the {@link RedirectService} construct.

*Example*

```typescript
new RedirectService(this, 'Redirects', {
  sourceDomains: [
    { domain: 'domainA.co.uk', fallbackUrl: 'https://domainA.com/uk' },
    { domain: 'domainA.co.nz', fallbackUrl: 'https://domainA.com/nz' },
  ],
  normalisationRules: [
    { rule: NormalisationRule.STRIP_WWW },
    { rule: NormalisationRule.LOWERCASE_PATH },
    { rule: NormalisationRule.DROP_FACETED_PARAMS, params: ['manufacturer', 'limit'] },
  ],
  enforceNoRedirectChains: true,
});
```


#### Initializer <a name="Initializer" id="raindancers-redirector.RedirectServiceProps.Initializer"></a>

```typescript
import { RedirectServiceProps } from 'raindancers-redirector'

const redirectServiceProps: RedirectServiceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.sourceDomains">sourceDomains</a></code> | <code><a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]</code> | Source domains to redirect from. |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.alertTopic">alertTopic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | SNS topic to receive CloudWatch alarm notifications. |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.cacheTtl">cacheTtl</a></code> | <code>number</code> | CloudFront cache TTL for redirect responses in seconds. |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.encryptionKey">encryptionKey</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | Optional KMS key for S3 bucket encryption (SSE-KMS). |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.enforceNoRedirectChains">enforceNoRedirectChains</a></code> | <code>boolean</code> | When true, the CSV loader rejects entries where the target URL returns a 3xx redirect instead of 200 OK. |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.normalisationRules">normalisationRules</a></code> | <code><a href="#raindancers-redirector.NormalisationRuleConfig">NormalisationRuleConfig</a>[]</code> | URL normalisation rules to apply before redirect lookup. |
| <code><a href="#raindancers-redirector.RedirectServiceProps.property.rateLimitPerIp">rateLimitPerIp</a></code> | <code>number</code> | WAF rate limit — maximum requests per IP address per 5-minute window. Exceeding this triggers a block action. |

---

##### `sourceDomains`<sup>Required</sup> <a name="sourceDomains" id="raindancers-redirector.RedirectServiceProps.property.sourceDomains"></a>

```typescript
public readonly sourceDomains: SourceDomain[];
```

- *Type:* <a href="#raindancers-redirector.SourceDomain">SourceDomain</a>[]

Source domains to redirect from.

Each domain gets a CloudFront alias, ACM certificate SAN (apex + wildcard),
and Route 53 A records pointing to the distribution.
At least one domain must be provided.

---

##### `alertTopic`<sup>Optional</sup> <a name="alertTopic" id="raindancers-redirector.RedirectServiceProps.property.alertTopic"></a>

```typescript
public readonly alertTopic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

SNS topic to receive CloudWatch alarm notifications.

When provided, all alarms (Lambda errors, DynamoDB throttles) send
notifications to this topic.

---

##### `cacheTtl`<sup>Optional</sup> <a name="cacheTtl" id="raindancers-redirector.RedirectServiceProps.property.cacheTtl"></a>

```typescript
public readonly cacheTtl: number;
```

- *Type:* number
- *Default:* 7776000 (90 days)

CloudFront cache TTL for redirect responses in seconds.

Applies to 301 and 302 responses. 404 and 410 responses use their own
cache headers set by the Lambda handler.

---

##### `encryptionKey`<sup>Optional</sup> <a name="encryptionKey" id="raindancers-redirector.RedirectServiceProps.property.encryptionKey"></a>

```typescript
public readonly encryptionKey: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

Optional KMS key for S3 bucket encryption (SSE-KMS).

When provided, the import bucket is encrypted with this key.
When omitted, the bucket uses S3-managed encryption (SSE-S3),
which is sufficient for non-sensitive redirect mapping data.

Use SSE-KMS when compliance frameworks (e.g. PCI-DSS, HIPAA) require
customer-managed keys or when you need key rotation control and
CloudTrail logging of key usage.

---

##### `enforceNoRedirectChains`<sup>Optional</sup> <a name="enforceNoRedirectChains" id="raindancers-redirector.RedirectServiceProps.property.enforceNoRedirectChains"></a>

```typescript
public readonly enforceNoRedirectChains: boolean;
```

- *Type:* boolean
- *Default:* true

When true, the CSV loader rejects entries where the target URL returns a 3xx redirect instead of 200 OK.

This prevents redirect chains where
the legacy URL redirects to a target that itself redirects elsewhere.

---

##### `normalisationRules`<sup>Optional</sup> <a name="normalisationRules" id="raindancers-redirector.RedirectServiceProps.property.normalisationRules"></a>

```typescript
public readonly normalisationRules: NormalisationRuleConfig[];
```

- *Type:* <a href="#raindancers-redirector.NormalisationRuleConfig">NormalisationRuleConfig</a>[]
- *Default:* [] (no normalisation)

URL normalisation rules to apply before redirect lookup.

Rules are applied by both the redirect handler (at request time) and
the CSV loader (when building DynamoDB keys).

If empty or omitted, no normalisation is performed — URLs are looked up
exactly as received.

---

##### `rateLimitPerIp`<sup>Optional</sup> <a name="rateLimitPerIp" id="raindancers-redirector.RedirectServiceProps.property.rateLimitPerIp"></a>

```typescript
public readonly rateLimitPerIp: number;
```

- *Type:* number
- *Default:* 100

WAF rate limit — maximum requests per IP address per 5-minute window. Exceeding this triggers a block action.

This limit does not apply to verified crawlers (Googlebot, Bingbot, etc.)
which are identified and allowed by the AWS Managed Bot Control rule.

---

### RedirectWafProps <a name="RedirectWafProps" id="raindancers-redirector.RedirectWafProps"></a>

Props for the {@link RedirectWaf} construct.

#### Initializer <a name="Initializer" id="raindancers-redirector.RedirectWafProps.Initializer"></a>

```typescript
import { RedirectWafProps } from 'raindancers-redirector'

const redirectWafProps: RedirectWafProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.RedirectWafProps.property.rateLimitPerIp">rateLimitPerIp</a></code> | <code>number</code> | Maximum requests per IP address per 5-minute window. Exceeding this triggers a block action. |

---

##### `rateLimitPerIp`<sup>Optional</sup> <a name="rateLimitPerIp" id="raindancers-redirector.RedirectWafProps.property.rateLimitPerIp"></a>

```typescript
public readonly rateLimitPerIp: number;
```

- *Type:* number
- *Default:* 100

Maximum requests per IP address per 5-minute window. Exceeding this triggers a block action.

Does not apply to verified crawlers (Googlebot, Bingbot, etc.) which are
identified by the Bot Control rule and excluded via a scope-down statement.

Note: AWS WAF minimum is 100 — values below this are not supported.

---

### SourceDomain <a name="SourceDomain" id="raindancers-redirector.SourceDomain"></a>

Represents a legacy domain that should be redirected.

Each source domain gets an apex and wildcard ACM certificate SAN,
Route 53 A records, and CloudFront aliases. An optional fallback URL
is seeded into DynamoDB at deploy time for unmatched paths.

#### Initializer <a name="Initializer" id="raindancers-redirector.SourceDomain.Initializer"></a>

```typescript
import { SourceDomain } from 'raindancers-redirector'

const sourceDomain: SourceDomain = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#raindancers-redirector.SourceDomain.property.domain">domain</a></code> | <code>string</code> | The legacy domain to redirect from. |
| <code><a href="#raindancers-redirector.SourceDomain.property.fallbackUrl">fallbackUrl</a></code> | <code>string</code> | Default redirect target for unmatched paths on this domain. |

---

##### `domain`<sup>Required</sup> <a name="domain" id="raindancers-redirector.SourceDomain.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string

The legacy domain to redirect from.

Must have a corresponding Route 53 public hosted zone in the same account.

---

*Example*

```typescript
'domainA.co.uk'
```


##### `fallbackUrl`<sup>Optional</sup> <a name="fallbackUrl" id="raindancers-redirector.SourceDomain.property.fallbackUrl"></a>

```typescript
public readonly fallbackUrl: string;
```

- *Type:* string

Default redirect target for unmatched paths on this domain.

When set, a `__fallback__` entry is seeded in DynamoDB at deploy time.
Requests that don't match any exact or pattern rule redirect here.
If not set, unmatched requests return 404.

---

*Example*

```typescript
'https://domainA.com/uk'
```




## Enums <a name="Enums" id="Enums"></a>

### NormalisationRule <a name="NormalisationRule" id="raindancers-redirector.NormalisationRule"></a>

URL normalisation rules that can be applied before redirect lookup.

Normalisation is opt-in. Only rules explicitly provided in the
`normalisationRules` prop of {@link RedirectServiceProps } are applied.
If no rules are provided, URLs are looked up exactly as received.

Rules are applied in the following order:
1. Host normalisation (STRIP_WWW)
2. Path normalisation (LOWERCASE_PATH, COLLAPSE_SLASHES, STRIP_INDEX_FILES, STRIP_HTML_EXTENSION, STRIP_TRAILING_SLASH)
3. Query string normalisation (DROP_FACETED_PARAMS, DROP_TRACKING_PARAMS)

When normalisation changes the incoming URL, the redirect handler issues a
301 redirect to the normalised form before performing the redirect lookup.
This ensures a single hop regardless of how many rules are applied.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#raindancers-redirector.NormalisationRule.STRIP_WWW">STRIP_WWW</a></code> | Strip the `www.` prefix from the request host. |
| <code><a href="#raindancers-redirector.NormalisationRule.LOWERCASE_PATH">LOWERCASE_PATH</a></code> | Lowercase the entire URL path. |
| <code><a href="#raindancers-redirector.NormalisationRule.COLLAPSE_SLASHES">COLLAPSE_SLASHES</a></code> | Collapse consecutive slashes in the path to a single slash. |
| <code><a href="#raindancers-redirector.NormalisationRule.STRIP_HTML_EXTENSION">STRIP_HTML_EXTENSION</a></code> | Strip the `.html` file extension from the end of the path. |
| <code><a href="#raindancers-redirector.NormalisationRule.STRIP_INDEX_FILES">STRIP_INDEX_FILES</a></code> | Strip `/index.php` and `/index.html` from the end of the path. Applied before STRIP_HTML_EXTENSION to correctly handle `/category/index.html`. |
| <code><a href="#raindancers-redirector.NormalisationRule.STRIP_TRAILING_SLASH">STRIP_TRAILING_SLASH</a></code> | Strip the trailing slash from the path, except for the root path `/`. |
| <code><a href="#raindancers-redirector.NormalisationRule.DROP_FACETED_PARAMS">DROP_FACETED_PARAMS</a></code> | Drop faceted/sort query parameters from the URL. |
| <code><a href="#raindancers-redirector.NormalisationRule.DROP_TRACKING_PARAMS">DROP_TRACKING_PARAMS</a></code> | Drop tracking query parameters from the URL. |

---

##### `STRIP_WWW` <a name="STRIP_WWW" id="raindancers-redirector.NormalisationRule.STRIP_WWW"></a>

Strip the `www.` prefix from the request host.

---


*Example*

```typescript
`www.example.co.uk` → `example.co.uk`
```


##### `LOWERCASE_PATH` <a name="LOWERCASE_PATH" id="raindancers-redirector.NormalisationRule.LOWERCASE_PATH"></a>

Lowercase the entire URL path.

---


*Example*

```typescript
`/Products/Widget` → `/products/widget`
```


##### `COLLAPSE_SLASHES` <a name="COLLAPSE_SLASHES" id="raindancers-redirector.NormalisationRule.COLLAPSE_SLASHES"></a>

Collapse consecutive slashes in the path to a single slash.

---


*Example*

```typescript
`/path//to///page` → `/path/to/page`
```


##### `STRIP_HTML_EXTENSION` <a name="STRIP_HTML_EXTENSION" id="raindancers-redirector.NormalisationRule.STRIP_HTML_EXTENSION"></a>

Strip the `.html` file extension from the end of the path.

---


*Example*

```typescript
`/about-us.html` → `/about-us`
```


##### `STRIP_INDEX_FILES` <a name="STRIP_INDEX_FILES" id="raindancers-redirector.NormalisationRule.STRIP_INDEX_FILES"></a>

Strip `/index.php` and `/index.html` from the end of the path. Applied before STRIP_HTML_EXTENSION to correctly handle `/category/index.html`.

---


*Example*

```typescript
`/shop/index.php` → `/shop`
```


##### `STRIP_TRAILING_SLASH` <a name="STRIP_TRAILING_SLASH" id="raindancers-redirector.NormalisationRule.STRIP_TRAILING_SLASH"></a>

Strip the trailing slash from the path, except for the root path `/`.

---


*Example*

```typescript
`/` → `/` (unchanged)
```


##### `DROP_FACETED_PARAMS` <a name="DROP_FACETED_PARAMS" id="raindancers-redirector.NormalisationRule.DROP_FACETED_PARAMS"></a>

Drop faceted/sort query parameters from the URL.

The specific parameters to drop are specified in the `params` field
of the {@link NormalisationRuleConfig}.

Requires `params` to be provided. The construct validates this at synth time.

---


*Example*

```typescript
With params `['manufacturer', 'limit']`:
`/products?manufacturer=acme&limit=10&color=red` → `/products?color=red`
```


##### `DROP_TRACKING_PARAMS` <a name="DROP_TRACKING_PARAMS" id="raindancers-redirector.NormalisationRule.DROP_TRACKING_PARAMS"></a>

Drop tracking query parameters from the URL.

The specific parameters to drop are specified in the `params` field
of the {@link NormalisationRuleConfig}.

By default (when this rule is not enabled), tracking parameters are
preserved and passed through to the redirect target URL.

Requires `params` to be provided. The construct validates this at synth time.

---


*Example*

```typescript
With params `['utm_source', 'fbclid']`:
`/page?utm_source=google&fbclid=abc&ref=site` → `/page?ref=site`
```

