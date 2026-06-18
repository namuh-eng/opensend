#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEFAULT_NAMESPACE = "Opensend";
export const DEFAULT_PREFIX = "opensend";
export const DEFAULT_ENVIRONMENT = "production";
export const DEFAULT_SNS_TOPIC_NAME = "opensend-ops-alerts";
export const MANAGED_BY = "opensend-alerting-script";
export const ISSUE = "639";

export type TreatMissingData = "breaching" | "notBreaching";
export type Statistic = "Sum" | "Maximum" | "Minimum" | "Average";
export type ComparisonOperator =
  | "GreaterThanOrEqualToThreshold"
  | "LessThanThreshold";

export type Dimensions = Record<string, string>;

export interface AlarmDefinition {
  slug: string;
  family: string;
  namespace: string;
  metricName: string;
  dimensions: Dimensions;
  statistic: Statistic;
  period: number;
  evaluationPeriods: number;
  datapointsToAlarm?: number;
  threshold: number;
  comparisonOperator: ComparisonOperator;
  treatMissingData: TreatMissingData;
  description: string;
  optional: boolean;
}

export interface EcsServiceInput {
  clusterName: string;
  serviceName: string;
  desiredCount: number;
}

export interface AlbTargetInput {
  loadBalancer: string;
  targetGroup: string;
  name: string;
  include5xx: boolean;
  target5xxThreshold: number;
}

export interface BuildPlanInput {
  environment?: string;
  prefix?: string;
  region?: string;
  namespace?: string;
  snsTopicArn?: string;
  snsTopicName?: string;
  subscriptionEmail?: string;
  notifyOk?: boolean;
  schedulerIntervalSeconds?: number;
  dlqQueueName?: string;
  dlqQueueUrl?: string;
  ecsServices?: EcsServiceInput[];
  albTargets?: AlbTargetInput[];
}

export interface AlarmPlan {
  environment: string;
  prefix: string;
  region: string;
  namespace: string;
  notification: {
    snsTopicArn: string;
    source: "provided-arn" | "topic-name-placeholder";
    subscriptionEmail?: string;
    requiresEmailConfirmation: boolean;
  };
  desiredAlarms: AlarmDefinition[];
  skipped: string[];
}

export interface CliOptions extends BuildPlanInput {
  apply: boolean;
  deleteStaleManagedAlarms: boolean;
  inspectAws: boolean;
  json: boolean;
}

interface AwsMetricAlarmPayload {
  AlarmName: string;
  AlarmDescription: string;
  ActionsEnabled: boolean;
  AlarmActions: string[];
  OKActions?: string[];
  Namespace: string;
  MetricName: string;
  Dimensions: Array<{ Name: string; Value: string }>;
  Statistic: Statistic;
  Period: number;
  EvaluationPeriods: number;
  DatapointsToAlarm?: number;
  Threshold: number;
  ComparisonOperator: ComparisonOperator;
  TreatMissingData: TreatMissingData;
  Tags: Array<{ Key: string; Value: string }>;
}

interface AwsCommandResult {
  stdout: string;
  stderr: string;
}

const QUEUE_PUBLISH_SERVICES = ["api", "ingester", "worker"] as const;
const DEFAULT_SCHEDULER_INTERVAL_SECONDS = 60;

function compact(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getRegion(input?: string): string {
  return compact(input) ?? compact(process.env.AWS_REGION) ?? "us-east-1";
}

function getEnvironment(input?: string): string {
  return (
    compact(input) ??
    compact(process.env.OPENSEND_ALERT_ENV) ??
    DEFAULT_ENVIRONMENT
  );
}

function getNamespace(input?: string): string {
  return (
    compact(input) ??
    compact(process.env.CLOUDWATCH_METRICS_NAMESPACE) ??
    DEFAULT_NAMESPACE
  );
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.floor(parsed);
}

function getSchedulerIntervalSeconds(input?: number): number {
  const raw = input ?? Number(process.env.INGESTER_SCHEDULER_INTERVAL_SECONDS);
  if (!Number.isFinite(raw) || raw < 10)
    return DEFAULT_SCHEDULER_INTERVAL_SECONDS;
  return Math.floor(raw);
}

function toCloudWatchStandardPeriod(seconds: number): number {
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function alarmName(input: {
  prefix: string;
  environment: string;
  slug: string;
}): string {
  return `${normalizeSlug(input.prefix)}-${normalizeSlug(input.environment)}-${normalizeSlug(input.slug)}`;
}

function description(input: {
  environment: string;
  family: string;
  detail: string;
}): string {
  return [
    input.detail,
    `Family=${input.family}`,
    `Environment=${input.environment}`,
    `ManagedBy=${MANAGED_BY}`,
    `Issue=#${ISSUE}`,
  ].join(" | ");
}

function parseQueueNameFromUrl(url: string | undefined): string | undefined {
  const value = compact(url);
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    return name ? decodeURIComponent(name) : undefined;
  } catch {
    return value.split("/").filter(Boolean).pop();
  }
}

export function parseEcsService(value: string): EcsServiceInput {
  const parts = value.includes(",") ? value.split(",") : value.split("/");
  const [clusterName, serviceName, rawDesiredCount] = parts.map((part) =>
    part.trim(),
  );
  if (!clusterName || !serviceName) {
    throw new Error(
      `Invalid --ecs-service value "${value}". Use cluster/service/desiredCount.`,
    );
  }
  const desiredCount = Number(rawDesiredCount ?? "1");
  if (!Number.isFinite(desiredCount) || desiredCount < 1) {
    throw new Error(
      `Invalid desired count in --ecs-service value "${value}". Use a positive number.`,
    );
  }
  return { clusterName, serviceName, desiredCount: Math.floor(desiredCount) };
}

export function parseAlbTarget(value: string): AlbTargetInput {
  const [loadBalancer, targetGroup, name, rawThreshold] = value
    .split(",")
    .map((part) => part.trim());
  if (!loadBalancer || !targetGroup || !name) {
    throw new Error(
      `Invalid --alb-target value "${value}". Use loadBalancer,targetGroup,name[,target5xxThreshold].`,
    );
  }
  const target5xxThreshold = Number(rawThreshold ?? "5");
  if (!Number.isFinite(target5xxThreshold) || target5xxThreshold < 1) {
    throw new Error(
      `Invalid 5xx threshold in --alb-target value "${value}". Use a positive number.`,
    );
  }
  return {
    loadBalancer,
    targetGroup,
    name: normalizeSlug(name),
    include5xx: true,
    target5xxThreshold: Math.floor(target5xxThreshold),
  };
}

function makeEmfFailureAlarm(input: {
  slug: string;
  family: string;
  namespace: string;
  metricName: string;
  dimensions: Dimensions;
  environment: string;
  detail: string;
}): AlarmDefinition {
  return {
    slug: input.slug,
    family: input.family,
    namespace: input.namespace,
    metricName: input.metricName,
    dimensions: input.dimensions,
    statistic: "Sum",
    period: 300,
    evaluationPeriods: 1,
    threshold: 1,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching",
    description: description({
      environment: input.environment,
      family: input.family,
      detail: input.detail,
    }),
    optional: false,
  };
}

export function buildAlarmPlan(input: BuildPlanInput = {}): AlarmPlan {
  const environment = getEnvironment(input.environment);
  const prefix = compact(input.prefix) ?? DEFAULT_PREFIX;
  const region = getRegion(input.region);
  const namespace = getNamespace(input.namespace);
  const snsTopicName = compact(input.snsTopicName) ?? DEFAULT_SNS_TOPIC_NAME;
  const snsTopicArn = compact(input.snsTopicArn);
  const subscriptionEmail = compact(input.subscriptionEmail);
  const skipped: string[] = [];
  const schedulerIntervalSeconds = getSchedulerIntervalSeconds(
    input.schedulerIntervalSeconds,
  );
  const schedulerHeartbeatPeriod = toCloudWatchStandardPeriod(
    schedulerIntervalSeconds,
  );
  const topicArn =
    snsTopicArn ?? `arn:aws:sns:${region}:<account-id>:${snsTopicName}`;
  const desiredAlarms: AlarmDefinition[] = [
    makeEmfFailureAlarm({
      slug: "send-failures-present",
      family: "send-failure-count",
      namespace,
      metricName: "SendFailed",
      dimensions: { Service: "worker", Operation: "ses.send" },
      environment,
      detail: "Alerts when provider send failures are recorded.",
    }),
    ...QUEUE_PUBLISH_SERVICES.flatMap((service) => [
      makeEmfFailureAlarm({
        slug: `queue-publish-failures-${service}`,
        family: "queue-publish-failure-count",
        namespace,
        metricName: "QueuePublishFailed",
        dimensions: { Service: service, Operation: "queue.publish" },
        environment,
        detail: `Alerts when ${service} queue publishing fails.`,
      }),
      makeEmfFailureAlarm({
        slug: `queue-publish-skipped-${service}`,
        family: "queue-publish-skipped-count",
        namespace,
        metricName: "QueuePublishSkipped",
        dimensions: { Service: service, Operation: "queue.publish" },
        environment,
        detail: `Alerts when ${service} jobs are skipped because no queue URL is configured.`,
      }),
    ]),
    makeEmfFailureAlarm({
      slug: "worker-job-failures-present",
      family: "worker-job-failure-count",
      namespace,
      metricName: "WorkerJobFailed",
      dimensions: { Service: "worker", Operation: "job.process" },
      environment,
      detail:
        "Alerts when worker jobs throw or terminal provider failures occur.",
    }),
    {
      slug: "scheduler-heartbeat-missed",
      family: "scheduler-heartbeat",
      namespace,
      metricName: "SchedulerHeartbeat",
      dimensions: { Service: "scheduler", Operation: "scheduler.batch" },
      statistic: "Sum",
      period: schedulerHeartbeatPeriod,
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      threshold: 1,
      comparisonOperator: "LessThanThreshold",
      treatMissingData: "breaching",
      description: description({
        environment,
        family: "scheduler-heartbeat",
        detail: `Alerts when the scheduler heartbeat is missing for about ${Math.round((schedulerHeartbeatPeriod * 5) / 60)} minutes.`,
      }),
      optional: false,
    },
    makeEmfFailureAlarm({
      slug: "scheduler-job-failures-present",
      family: "scheduler-job-failure-count",
      namespace,
      metricName: "SchedulerJobFailed",
      dimensions: { Service: "scheduler", Operation: "scheduler.job" },
      environment,
      detail: "Alerts when scheduler job HTTP calls fail or return non-2xx.",
    }),
    makeEmfFailureAlarm({
      slug: "ses-ingest-failures-present",
      family: "ses-ingest-failure-count",
      namespace,
      metricName: "SesEventIngestFailed",
      dimensions: {
        Service: "ingester",
        Operation: "ses.ingest",
        Outcome: "failed",
      },
      environment,
      detail: "Alerts when SES/SNS ingest fails inside the ingester.",
    }),
  ];

  const dlqQueueName =
    compact(input.dlqQueueName) ?? parseQueueNameFromUrl(input.dlqQueueUrl);
  if (dlqQueueName) {
    desiredAlarms.push({
      slug: "dlq-messages-present",
      family: "sqs-dlq-depth",
      namespace: "AWS/SQS",
      metricName: "ApproximateNumberOfMessagesVisible",
      dimensions: { QueueName: dlqQueueName },
      statistic: "Maximum",
      period: 60,
      evaluationPeriods: 1,
      threshold: 1,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      treatMissingData: "notBreaching",
      description: description({
        environment,
        family: "sqs-dlq-depth",
        detail: "Alerts when messages are visible in the configured SQS DLQ.",
      }),
      optional: true,
    });
  } else {
    skipped.push("sqs-dlq-depth: pass --dlq-queue-name or --dlq-queue-url");
  }

  for (const service of input.ecsServices ?? []) {
    desiredAlarms.push({
      slug: `${normalizeSlug(service.serviceName)}-running-tasks-low`,
      family: "ecs-running-tasks",
      namespace: "ECS/ContainerInsights",
      metricName: "RunningTaskCount",
      dimensions: {
        ClusterName: service.clusterName,
        ServiceName: service.serviceName,
      },
      statistic: "Minimum",
      period: 60,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      threshold: service.desiredCount,
      comparisonOperator: "LessThanThreshold",
      treatMissingData: "breaching",
      description: description({
        environment,
        family: "ecs-running-tasks",
        detail:
          "Alerts when ECS Container Insights reports fewer running tasks than desired.",
      }),
      optional: true,
    });
  }
  if ((input.ecsServices ?? []).length === 0) {
    skipped.push(
      "ecs-running-tasks: pass --ecs-service cluster/service/desiredCount and enable Container Insights",
    );
  }

  for (const target of input.albTargets ?? []) {
    desiredAlarms.push(
      {
        slug: `${target.name}-unhealthy-hosts`,
        family: "alb-unhealthy-hosts",
        namespace: "AWS/ApplicationELB",
        metricName: "UnHealthyHostCount",
        dimensions: {
          LoadBalancer: target.loadBalancer,
          TargetGroup: target.targetGroup,
        },
        statistic: "Minimum",
        period: 60,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        threshold: 1,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        treatMissingData: "notBreaching",
        description: description({
          environment,
          family: "alb-unhealthy-hosts",
          detail: "Alerts when the ALB target group has unhealthy targets.",
        }),
        optional: true,
      },
      {
        slug: `${target.name}-target-5xx`,
        family: "alb-target-5xx",
        namespace: "AWS/ApplicationELB",
        metricName: "HTTPCode_Target_5XX_Count",
        dimensions: {
          LoadBalancer: target.loadBalancer,
          TargetGroup: target.targetGroup,
        },
        statistic: "Sum",
        period: 300,
        evaluationPeriods: 1,
        threshold: target.target5xxThreshold,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        treatMissingData: "notBreaching",
        description: description({
          environment,
          family: "alb-target-5xx",
          detail:
            "Alerts when the ALB target group returns target 5xx responses.",
        }),
        optional: true,
      },
    );
  }
  if ((input.albTargets ?? []).length === 0) {
    skipped.push(
      "alb-platform-health: pass --alb-target loadBalancer,targetGroup,name[,target5xxThreshold]",
    );
  }

  return {
    environment,
    prefix,
    region,
    namespace,
    notification: {
      snsTopicArn: topicArn,
      source: snsTopicArn ? "provided-arn" : "topic-name-placeholder",
      ...(subscriptionEmail ? { subscriptionEmail } : {}),
      requiresEmailConfirmation: Boolean(subscriptionEmail),
    },
    desiredAlarms,
    skipped,
  };
}

export function toPutMetricAlarmPayload(input: {
  plan: AlarmPlan;
  alarm: AlarmDefinition;
  notifyOk?: boolean;
}): AwsMetricAlarmPayload {
  const name = alarmName({
    prefix: input.plan.prefix,
    environment: input.plan.environment,
    slug: input.alarm.slug,
  });
  return {
    AlarmName: name,
    AlarmDescription: input.alarm.description,
    ActionsEnabled: true,
    AlarmActions: [input.plan.notification.snsTopicArn],
    ...(input.notifyOk
      ? { OKActions: [input.plan.notification.snsTopicArn] }
      : {}),
    Namespace: input.alarm.namespace,
    MetricName: input.alarm.metricName,
    Dimensions: Object.entries(input.alarm.dimensions).map(([Name, Value]) => ({
      Name,
      Value,
    })),
    Statistic: input.alarm.statistic,
    Period: input.alarm.period,
    EvaluationPeriods: input.alarm.evaluationPeriods,
    ...(input.alarm.datapointsToAlarm
      ? { DatapointsToAlarm: input.alarm.datapointsToAlarm }
      : {}),
    Threshold: input.alarm.threshold,
    ComparisonOperator: input.alarm.comparisonOperator,
    TreatMissingData: input.alarm.treatMissingData,
    Tags: [
      { Key: "Project", Value: "opensend" },
      { Key: "Environment", Value: input.plan.environment },
      { Key: "ManagedBy", Value: MANAGED_BY },
      { Key: "Issue", Value: ISSUE },
    ],
  };
}

export function renderPlan(input: {
  plan: AlarmPlan;
  notifyOk?: boolean;
}): {
  alarms: AwsMetricAlarmPayload[];
  skipped: string[];
  notification: AlarmPlan["notification"];
} {
  return {
    notification: input.plan.notification,
    alarms: input.plan.desiredAlarms.map((alarm) =>
      toPutMetricAlarmPayload({
        plan: input.plan,
        alarm,
        notifyOk: input.notifyOk,
      }),
    ),
    skipped: input.plan.skipped,
  };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    deleteStaleManagedAlarms: false,
    inspectAws: false,
    json: false,
    ecsServices: [],
    albTargets: [],
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    switch (arg) {
      case "--apply":
        options.apply = true;
        break;
      case "--delete-stale-managed-alarms":
        options.deleteStaleManagedAlarms = true;
        break;
      case "--inspect-aws":
        options.inspectAws = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--notify-ok":
        options.notifyOk = true;
        break;
      case "--scheduler-interval-seconds":
        options.schedulerIntervalSeconds = parsePositiveInteger(
          next(),
          "--scheduler-interval-seconds",
        );
        break;
      case "--env":
        options.environment = next();
        break;
      case "--prefix":
        options.prefix = next();
        break;
      case "--region":
        options.region = next();
        break;
      case "--namespace":
        options.namespace = next();
        break;
      case "--sns-topic-arn":
        options.snsTopicArn = next();
        break;
      case "--sns-topic-name":
        options.snsTopicName = next();
        break;
      case "--subscription-email":
        options.subscriptionEmail = next();
        break;
      case "--dlq-queue-name":
        options.dlqQueueName = next();
        break;
      case "--dlq-queue-url":
        options.dlqQueueUrl = next();
        break;
      case "--ecs-service":
        options.ecsServices = [
          ...(options.ecsServices ?? []),
          parseEcsService(next()),
        ];
        break;
      case "--alb-target":
        options.albTargets = [
          ...(options.albTargets ?? []),
          parseAlbTarget(next()),
        ];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.deleteStaleManagedAlarms && !options.apply) {
    throw new Error("--delete-stale-managed-alarms requires --apply");
  }

  return options;
}

function runAws(args: string[], input?: string): AwsCommandResult {
  const result = spawnSync("aws", args, {
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if ((result.status ?? 0) !== 0) {
    throw new Error(
      `aws ${args.join(" ")} failed with exit ${result.status}: ${result.stderr}`,
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(value: unknown, field: string): string | null {
  if (!isRecord(value)) return null;
  const candidate = value[field];
  return typeof candidate === "string" ? candidate : null;
}

function subscribeEmailIfRequested(
  options: CliOptions,
  plan: AlarmPlan,
  topicArn: string,
): void {
  if (!options.apply || !options.subscriptionEmail) return;

  runAws([
    "sns",
    "subscribe",
    "--region",
    plan.region,
    "--topic-arn",
    topicArn,
    "--protocol",
    "email",
    "--notification-endpoint",
    options.subscriptionEmail,
  ]);
}

function resolveSnsTopicArn(options: CliOptions, plan: AlarmPlan): string {
  if (options.snsTopicArn) return options.snsTopicArn;
  if (!options.apply) return plan.notification.snsTopicArn;

  const topicName = options.snsTopicName ?? DEFAULT_SNS_TOPIC_NAME;
  const result = runAws([
    "sns",
    "create-topic",
    "--region",
    plan.region,
    "--name",
    topicName,
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(result.stdout) as unknown;
  const topicArn = readStringField(parsed, "TopicArn");
  if (!topicArn)
    throw new Error("aws sns create-topic did not return TopicArn");

  return topicArn;
}

function withTopicArn(plan: AlarmPlan, snsTopicArn: string): AlarmPlan {
  return {
    ...plan,
    notification: {
      ...plan.notification,
      snsTopicArn,
      source: "provided-arn",
    },
  };
}

function hasManagedTags(alarmArn: string, region: string): boolean {
  const result = runAws([
    "cloudwatch",
    "list-tags-for-resource",
    "--region",
    region,
    "--resource-arn",
    alarmArn,
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(result.stdout) as unknown;
  const tags =
    isRecord(parsed) && Array.isArray(parsed.Tags) ? parsed.Tags : [];
  return (
    tags.some((tag) => {
      if (!isRecord(tag)) return false;
      return tag.Key === "ManagedBy" && tag.Value === MANAGED_BY;
    }) &&
    tags.some((tag) => {
      if (!isRecord(tag)) return false;
      return tag.Key === "Issue" && tag.Value === ISSUE;
    })
  );
}

function listManagedAlarmNames(plan: AlarmPlan): string[] {
  const prefix = `${normalizeSlug(plan.prefix)}-${normalizeSlug(plan.environment)}-`;
  const result = runAws([
    "cloudwatch",
    "describe-alarms",
    "--region",
    plan.region,
    "--alarm-name-prefix",
    prefix,
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(result.stdout) as unknown;
  const alarms =
    isRecord(parsed) && Array.isArray(parsed.MetricAlarms)
      ? parsed.MetricAlarms
      : [];
  return alarms
    .filter((alarm): alarm is Record<string, unknown> => isRecord(alarm))
    .filter((alarm) => {
      const alarmArn = readStringField(alarm, "AlarmArn");
      return alarmArn ? hasManagedTags(alarmArn, plan.region) : false;
    })
    .map((alarm) => alarm.AlarmName)
    .filter((name): name is string => typeof name === "string");
}

function desiredAlarmNames(plan: AlarmPlan): Set<string> {
  return new Set(
    plan.desiredAlarms.map((alarm) =>
      alarmName({
        prefix: plan.prefix,
        environment: plan.environment,
        slug: alarm.slug,
      }),
    ),
  );
}

function printHumanPlan(rendered: ReturnType<typeof renderPlan>): void {
  console.log("OpenSend CloudWatch alarm plan (dry-run by default)");
  console.log(`Notification SNS topic: ${rendered.notification.snsTopicArn}`);
  if (rendered.notification.subscriptionEmail) {
    console.log(
      `Email subscription requested: ${rendered.notification.subscriptionEmail} (SNS confirmation required)`,
    );
  }
  console.log(`Desired alarms: ${rendered.alarms.length}`);
  for (const alarm of rendered.alarms) {
    const dimensions = alarm.Dimensions.map(
      (dimension) => `${dimension.Name}=${dimension.Value}`,
    ).join(", ");
    console.log(
      `- ${alarm.AlarmName}: ${alarm.Namespace}/${alarm.MetricName} [${dimensions}] ${alarm.ComparisonOperator} ${alarm.Threshold}`,
    );
  }
  if (rendered.skipped.length > 0) {
    console.log("Skipped optional alarm groups:");
    for (const skipped of rendered.skipped) console.log(`- ${skipped}`);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  let plan = buildAlarmPlan(options);
  const topicArn = resolveSnsTopicArn(options, plan);
  subscribeEmailIfRequested(options, plan, topicArn);
  plan = withTopicArn(plan, topicArn);
  const rendered = renderPlan({ plan, notifyOk: options.notifyOk });

  const inspectAws = options.inspectAws || options.apply;
  const staleManagedAlarms = inspectAws
    ? listManagedAlarmNames(plan).filter(
        (name) => !desiredAlarmNames(plan).has(name),
      )
    : [];

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          ...rendered,
          staleManagedAlarms,
          staleInspection: inspectAws ? "completed" : "skipped",
        },
        null,
        2,
      ),
    );
  } else {
    printHumanPlan(rendered);
    if (!inspectAws) {
      console.log(
        "Stale managed alarm inspection skipped; pass --inspect-aws to list candidates without mutating AWS.",
      );
    } else if (staleManagedAlarms.length > 0) {
      console.log("Stale managed alarm candidates:");
      for (const name of staleManagedAlarms) console.log(`- ${name}`);
    }
  }

  if (!options.apply) return;

  for (const payload of rendered.alarms) {
    runAws([
      "cloudwatch",
      "put-metric-alarm",
      "--region",
      plan.region,
      "--cli-input-json",
      JSON.stringify(payload),
    ]);
  }

  if (options.deleteStaleManagedAlarms && staleManagedAlarms.length > 0) {
    runAws([
      "cloudwatch",
      "delete-alarms",
      "--region",
      plan.region,
      "--alarm-names",
      ...staleManagedAlarms,
    ]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
