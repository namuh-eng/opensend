import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAlarmPlan,
  renderPlan,
  toTagResourceArgs,
} from "../scripts/create-cloudwatch-alarms";

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function dimensionKey(
  dimensions: Array<{ Name: string; Value: string }>,
): string {
  return dimensions
    .map((dimension) => `${dimension.Name}=${dimension.Value}`)
    .sort()
    .join("|");
}

describe("production alerting manifest", () => {
  it("renders required alarms with exact alarm-friendly EMF dimensions", () => {
    const plan = buildAlarmPlan({
      environment: "prod",
      snsTopicArn: "arn:aws:sns:us-east-1:123456789012:opensend-ops",
      schedulerIntervalSeconds: 120,
      dlqQueueName: "opensend-prod-dlq",
      ecsServices: [
        { clusterName: "namuh", serviceName: "opensend-app", desiredCount: 1 },
      ],
      albTargets: [
        {
          loadBalancer: "app/opensend/abc",
          targetGroup: "targetgroup/opensend/def",
          name: "app",
          include5xx: true,
          target5xxThreshold: 5,
        },
      ],
    });
    const rendered = renderPlan({ plan });
    const byMetric = new Map(
      rendered.alarms.map((alarm) => [alarm.MetricName, alarm]),
    );

    expect(byMetric.get("SendFailed")?.Dimensions).toEqual([
      { Name: "Service", Value: "worker" },
      { Name: "Operation", Value: "ses.send" },
    ]);
    expect(byMetric.get("WorkerJobFailed")?.Dimensions).toEqual([
      { Name: "Service", Value: "worker" },
      { Name: "Operation", Value: "job.process" },
    ]);
    expect(byMetric.get("SchedulerHeartbeat")?.TreatMissingData).toBe(
      "breaching",
    );
    expect(byMetric.get("SchedulerHeartbeat")?.Period).toBe(120);
    expect(byMetric.get("SchedulerJobFailed")?.TreatMissingData).toBe(
      "notBreaching",
    );

    const unhealthyHostAlarm = byMetric.get("UnHealthyHostCount");
    expect(unhealthyHostAlarm?.Statistic).toBe("Maximum");
    expect(unhealthyHostAlarm?.Threshold).toBe(1);
    expect(unhealthyHostAlarm?.ComparisonOperator).toBe(
      "GreaterThanOrEqualToThreshold",
    );

    expect(byMetric.get("SesEventIngestFailed")?.Dimensions).toEqual([
      { Name: "Service", Value: "ingester" },
      { Name: "Operation", Value: "ses.ingest" },
      { Name: "Outcome", Value: "failed" },
    ]);

    const queuePublishAlarms = rendered.alarms.filter(
      (alarm) => alarm.MetricName === "QueuePublishFailed",
    );
    expect(queuePublishAlarms.map((alarm) => alarm.AlarmName).sort()).toEqual([
      "opensend-prod-queue-publish-failures-api",
      "opensend-prod-queue-publish-failures-ingester",
      "opensend-prod-queue-publish-failures-worker",
    ]);
    expect(
      queuePublishAlarms.map((alarm) => dimensionKey(alarm.Dimensions)),
    ).toEqual(
      expect.arrayContaining([
        "Operation=queue.publish|Service=api",
        "Operation=queue.publish|Service=ingester",
        "Operation=queue.publish|Service=worker",
      ]),
    );

    const queueSkippedAlarms = rendered.alarms.filter(
      (alarm) => alarm.MetricName === "QueuePublishSkipped",
    );
    expect(queueSkippedAlarms.map((alarm) => alarm.AlarmName).sort()).toEqual([
      "opensend-prod-queue-publish-skipped-api",
      "opensend-prod-queue-publish-skipped-ingester",
      "opensend-prod-queue-publish-skipped-worker",
    ]);
  });

  it("keeps notification and mutation gates explicit", () => {
    const script = readRepoFile("scripts/create-cloudwatch-alarms.ts");
    const gitignore = readRepoFile(".gitignore");

    expect(gitignore).toContain("!scripts/create-cloudwatch-alarms.ts");
    expect(script).toContain("--apply");
    expect(script).toContain("--delete-stale-managed-alarms requires --apply");
    expect(script).toContain(
      "subscribeEmailIfRequested(options, plan, topicArn)",
    );
    expect(script).toContain("list-tags-for-resource");
    expect(script).toContain("tag-resource");
    expect(script).toContain("applyMetricAlarm(plan.region, payload)");
    expect(script).toContain("readAlarmArnByName(payload.AlarmName, region)");
    expect(script).toContain("protocol");
    expect(script).toContain("email");
    expect(script).toContain("SNS confirmation required");
  });

  it("builds a post-apply tag-resource command to repair existing alarm tags", () => {
    const plan = buildAlarmPlan({
      environment: "prod",
      snsTopicArn: "arn:aws:sns:us-east-1:123456789012:opensend-ops",
    });
    const [alarm] = renderPlan({ plan }).alarms;

    expect(
      toTagResourceArgs({
        region: plan.region,
        alarmArn:
          "arn:aws:cloudwatch:us-east-1:123456789012:alarm:opensend-prod-send-failures-present",
        tags: alarm.Tags,
      }),
    ).toEqual([
      "cloudwatch",
      "tag-resource",
      "--region",
      "us-east-1",
      "--resource-arn",
      "arn:aws:cloudwatch:us-east-1:123456789012:alarm:opensend-prod-send-failures-present",
      "--tags",
      JSON.stringify([
        { Key: "Project", Value: "opensend" },
        { Key: "Environment", Value: "prod" },
        { Key: "ManagedBy", Value: "opensend-alerting-script" },
        { Key: "Issue", Value: "639" },
      ]),
    ]);
  });

  it("guards aggregate metric emission shape in source", () => {
    const backgroundJobs = readRepoFile(
      "packages/core/src/jobs/background-jobs.ts",
    );
    const queueWorker = readRepoFile("packages/ingester/src/queue-worker.ts");
    const scheduler = readRepoFile("packages/ingester/src/job-scheduler.ts");

    expect(backgroundJobs).toContain('"QueuePublishFailed"');
    expect(backgroundJobs).toContain('"QueuePublishSkipped"');
    expect(backgroundJobs).toContain('Operation: "queue.publish"');
    expect(backgroundJobs).toContain("job_type: job.type");

    expect(queueWorker).toContain('name: "SendFailed"');
    expect(queueWorker).toContain('Operation: "ses.send"');
    expect(queueWorker).toContain('name: "WorkerJobFailed"');
    expect(queueWorker).toContain("terminalProviderFailure");
    expect(queueWorker).toContain('reason: "terminal_provider_failure"');
    expect(queueWorker).toContain('reason: "thrown_job_failure"');

    expect(scheduler).toContain('name: "SchedulerHeartbeat"');
    expect(scheduler).toContain('name: "SchedulerJobFailed"');
    expect(scheduler).toContain("job: job.name");
    expect(scheduler).toContain('Operation: "scheduler.batch"');
    expect(scheduler).toContain('Operation: "scheduler.job"');
  });
  it("documents the alerting command and runbook", () => {
    const observability = readRepoFile("docs/observability.md");
    const publicObservability = readRepoFile("public/docs/observability.md");
    const selfHosting = readRepoFile("docs/self-hosting.md");
    const runbook = readRepoFile("agent_docs/runbooks/alerts.md");
    const llms = readRepoFile("public/docs/llms.txt");

    for (const doc of [
      observability,
      publicObservability,
      selfHosting,
      runbook,
    ]) {
      expect(doc).toContain("scripts/create-cloudwatch-alarms.ts");
    }
    expect(observability).toContain("exact namespace/name/dimension match");
    expect(observability).toContain("QueuePublishSkipped");
    expect(observability).toContain("--scheduler-interval-seconds");
    expect(runbook).toContain("SNS confirmation");
    expect(runbook).toContain("Send failure rate");
    expect(llms).toContain(
      "Operate OpenSend in production with health checks, structured logs, API request logs",
    );
  });
});
