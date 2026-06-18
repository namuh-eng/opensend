import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function jobEndpointsFromIngester(): string[] {
  const source = readRepoFile("packages/ingester/src/index.ts");
  const matches = source.matchAll(/app\.post\("(\/jobs\/[^"]+)"/g);
  return Array.from(matches, (match) => match[1]).sort();
}

describe("ingester job scheduler coverage", () => {
  it("schedules and documents every non-manual ingester job endpoint", () => {
    const manualOnlyEndpoints = new Set(["/jobs/poll"]);
    const scheduledEndpoints = jobEndpointsFromIngester().filter(
      (endpoint) => !manualOnlyEndpoints.has(endpoint),
    );

    expect(scheduledEndpoints).toEqual([
      "/jobs/billing-overage",
      "/jobs/domain-verify",
      "/jobs/scheduled-emails",
      "/jobs/webhooks",
    ]);

    const schedulerSource = readRepoFile(
      "packages/ingester/src/job-scheduler.ts",
    );
    const compose = readRepoFile("docker-compose.yml");
    const deploymentDocs = [
      readRepoFile("README.md"),
      readRepoFile("docs/ingester-deploy.md"),
      readRepoFile("docs/self-hosting.md"),
      readRepoFile(".env.example"),
    ].join("\n");

    for (const endpoint of scheduledEndpoints) {
      expect(schedulerSource).toContain(endpoint);
      expect(compose).toContain(endpoint);
      expect(deploymentDocs).toContain(endpoint);
    }
  });

  it("keeps scheduler bearer auth aligned with INGESTER_JOB_TOKEN", () => {
    const schedulerSource = readRepoFile(
      "packages/ingester/src/job-scheduler.ts",
    );
    const compose = readRepoFile("docker-compose.yml");
    const docs = [
      readRepoFile("docs/ingester-deploy.md"),
      readRepoFile("docs/self-hosting.md"),
      readRepoFile(".env.example"),
    ].join("\n");

    expect(schedulerSource).toContain('getEnv("INGESTER_JOB_TOKEN")');
    expect(schedulerSource).toContain("authorization: `Bearer ${token}`");
    expect(compose).toContain(
      "INGESTER_JOB_TOKEN: ${INGESTER_JOB_TOKEN:?Set INGESTER_JOB_TOKEN in .env (32+ chars)}",
    );
    expect(docs).toContain("Authorization: Bearer ${INGESTER_JOB_TOKEN}");
  });
  it("emits alarm-friendly scheduler heartbeat and failure metrics", () => {
    const schedulerSource = readRepoFile(
      "packages/ingester/src/job-scheduler.ts",
    );

    expect(schedulerSource).toContain('name: "SchedulerHeartbeat"');
    expect(schedulerSource).toContain('name: "SchedulerJobFailed"');
    expect(schedulerSource).toContain('Service: "scheduler"');
    expect(schedulerSource).toContain('Operation: "scheduler.batch"');
    expect(schedulerSource).toContain('Operation: "scheduler.job"');
    expect(schedulerSource).toContain("job: job.name");
  });
});
