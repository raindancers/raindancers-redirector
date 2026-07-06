import {
  Duration,
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cw_actions,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_sns as sns,
} from 'aws-cdk-lib';

import { Construct } from 'constructs';

/**
 * Props for the {@link Monitoring} construct.
 */
export interface MonitoringProps {
  /** The redirect handler Lambda to monitor for errors. */
  readonly redirectHandler: lambda.Function;

  /** The invalidation handler Lambda to monitor for errors. */
  readonly invalidationHandler: lambda.Function;

  /** The DynamoDB table to monitor for throttles. */
  readonly table: dynamodb.Table;

  /**
   * Optional SNS topic for alarm notifications.
   * When provided, all alarms will send ALARM state notifications to this topic.
   */
  readonly alertTopic?: sns.ITopic;
}

/**
 * CloudWatch alarms for the redirect service.
 *
 * Creates three alarms:
 *
 * 1. **Redirect handler errors** — fires when the redirect handler Lambda
 *    has any errors in a 1-minute period. Indicates lookup failures that
 *    result in 5xx responses to users.
 *
 * 2. **DynamoDB throttles** — fires when the redirects table throttles any
 *    operation (GetItem, Query, PutItem, BatchWriteItem) in a 1-minute period.
 *    Indicates capacity issues (unlikely with on-demand billing unless there's
 *    a sudden extreme burst).
 *
 * 3. **Invalidation handler errors** — fires when the invalidation Lambda
 *    has any errors in a 5-minute period. Indicates cache invalidation failures
 *    which mean stale redirects may be served.
 *
 * All alarms use `GreaterThanThreshold` with threshold 0 — any error triggers.
 * When an `alertTopic` is provided, all three alarms send ALARM notifications.
 *
 * @example
 *
 * new Monitoring(this, 'Monitoring', {
 *   redirectHandler: handler.handler,
 *   invalidationHandler: invalidation.handler,
 *   table: table.table,
 *   alertTopic: myTopic,
 * });
 *
 */
export class Monitoring extends Construct {
  /** Alarm that fires on redirect handler Lambda errors. */
  public readonly redirectErrorAlarm: cloudwatch.Alarm;

  /** Alarm that fires on DynamoDB throttles. */
  public readonly throttleAlarm: cloudwatch.Alarm;

  /** Alarm that fires on invalidation Lambda errors. */
  public readonly invalidationErrorAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // Redirect handler error alarm
    const redirectHandlerErrors = props.redirectHandler.metricErrors({
      period: Duration.minutes(1),
    });
    this.redirectErrorAlarm = new cloudwatch.Alarm(this, 'RedirectHandlerErrorAlarm', {
      metric: redirectHandlerErrors,
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'Redirect handler Lambda errors detected',
    });

    // DynamoDB throttle alarm
    const dynamoThrottles = props.table.metricThrottledRequestsForOperations({
      operations: [
        dynamodb.Operation.GET_ITEM,
        dynamodb.Operation.QUERY,
        dynamodb.Operation.PUT_ITEM,
        dynamodb.Operation.BATCH_WRITE_ITEM,
      ],
      period: Duration.minutes(1),
    });
    this.throttleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
      metric: dynamoThrottles,
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'DynamoDB throttling detected on redirects table',
    });

    // Invalidation Lambda error alarm
    const invalidationErrors = props.invalidationHandler.metricErrors({
      period: Duration.minutes(5),
    });
    this.invalidationErrorAlarm = new cloudwatch.Alarm(this, 'InvalidationErrorAlarm', {
      metric: invalidationErrors,
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'Invalidation Lambda errors detected',
    });

    // Wire optional SNS topic for alerts
    if (props.alertTopic) {
      const snsAction = new cw_actions.SnsAction(props.alertTopic);
      this.redirectErrorAlarm.addAlarmAction(snsAction);
      this.throttleAlarm.addAlarmAction(snsAction);
      this.invalidationErrorAlarm.addAlarmAction(snsAction);
    }
  }
}
