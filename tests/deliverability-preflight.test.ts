import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DomainReport,
  parseArgs,
  reportIssues,
  validateSesEventsSnsTopicArn,
} from "../src/lib/deliverability/repair-preflight";

const root = join(__dirname, "..");
const topicArn = "arn:aws:sns:us-east-1:123456789012:opensend-ses-events";
const matchingEventTypes = [
  "SEND",
  "DELIVERY",
  "BOUNCE",
  "COMPLAINT",
  "DELIVERY_DELAY",
  "REJECT",
  "RENDERING_FAILURE",
];

describe("deliverability preflight repair utility", () => {
  it("parses read-only, strict, json, filter, and bounded limit options", () => {
    expect(
      parseArgs([
        "--json",
        "--strict",
        "--domain",
        "example.com",
        "--limit",
        "999",
      ]),
    ).toEqual({
      repair: false,
      strict: true,
      json: true,
      domain: "example.com",
      limit: 500,
    });

    expect(parseArgs(["--repair", "--limit", "25"])).toEqual({
      repair: true,
      strict: false,
      json: false,
      domain: null,
      limit: 25,
    });
  });

  it("classifies missing write-back, missing destination, disabled destination, and command errors", () => {
    const report: DomainReport = {
      domainId: "domain-1",
      domainName: "example.com",
      region: "us-east-1",
      previousConfigSetName: null,
      resultingConfigSetName: null,
      dbWriteBack: false,
      eventDestination: {
        configured: false,
        enabled: null,
        topicArn: null,
        matchingEventTypes: [],
      },
      mode: "preflight",
      error: "not found",
    };

    expect(reportIssues(report)).toEqual([
      "missing_config_set_writeback",
      "missing_ses_event_destination",
      "repair_or_preflight_error",
    ]);

    expect(
      reportIssues({
        ...report,
        resultingConfigSetName: "opensend-domain-domain-1",
        dbWriteBack: true,
        eventDestination: {
          configured: true,
          enabled: false,
          topicArn,
          matchingEventTypes: ["SEND"],
        },
        error: null,
      }),
    ).toEqual(["disabled_ses_event_destination"]);
  });

  it("classifies wrong-topic and incomplete SES event destinations as drift", () => {
    const baseReport: DomainReport = {
      domainId: "domain-1",
      domainName: "example.com",
      region: "us-east-1",
      previousConfigSetName: "opensend-domain-domain-1",
      resultingConfigSetName: "opensend-domain-domain-1",
      dbWriteBack: true,
      eventDestination: {
        configured: true,
        enabled: true,
        topicArn,
        matchingEventTypes,
      },
      mode: "preflight",
      error: null,
    };

    expect(reportIssues(baseReport, topicArn)).toEqual([]);
    expect(
      reportIssues(
        {
          ...baseReport,
          eventDestination: {
            configured: true,
            enabled: true,
            topicArn: "arn:aws:sns:us-east-1:123456789012:other-topic",
            matchingEventTypes,
          },
        },
        topicArn,
      ),
    ).toEqual(["wrong_ses_event_destination_topic"]);
    expect(
      reportIssues(
        {
          ...baseReport,
          eventDestination: {
            configured: true,
            enabled: true,
            topicArn,
            matchingEventTypes: ["SEND", "DELIVERY"],
          },
        },
        topicArn,
      ),
    ).toEqual(["missing_ses_event_types"]);
  });

  it("requires a valid SNS topic ARN before repair can mutate state", () => {
    expect(validateSesEventsSnsTopicArn(null)).toBe(
      "SES_EVENTS_SNS_TOPIC_ARN is required for --repair",
    );
    expect(validateSesEventsSnsTopicArn("not-an-arn")).toBe(
      "SES_EVENTS_SNS_TOPIC_ARN must be an SNS topic ARN",
    );
    expect(
      validateSesEventsSnsTopicArn(
        "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
      ),
    ).toBeNull();
  });

  it("documents that repair aborts before syncing when the topic ARN is missing", () => {
    const source = readFileSync(
      join(root, "src", "lib", "deliverability", "repair-preflight.ts"),
      "utf-8",
    );
    expect(
      source.indexOf("validateSesEventsSnsTopicArn(topicArn)"),
    ).toBeLessThan(source.indexOf("loadVerifiedDomains(options)"));
    expect(source.indexOf("process.exit(1);")).toBeLessThan(
      source.indexOf("loadVerifiedDomains(options)"),
    );
  });

  it("exposes the tracked preflight utility through package scripts", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.scripts["deliverability:preflight"]).toBe(
      "bun src/lib/deliverability/repair-preflight.ts",
    );

    const source = readFileSync(
      join(root, "src", "lib", "deliverability", "repair-preflight.ts"),
      "utf-8",
    );
    expect(source).toContain("--repair");
    expect(source).toContain("SES_EVENTS_SNS_TOPIC_ARN");
    expect(source).toContain("sesConfigurationSetName");
    expect(source).toContain("getConfigurationSetEventDestinationState");
  });

  it("documents the operator repair flow without hardcoded production ARNs", () => {
    const docs = readFileSync(
      join(root, "docs", "ingester-deploy.md"),
      "utf-8",
    );
    const publicDocs = readFileSync(
      join(root, "public", "docs", "ingester-deploy.md"),
      "utf-8",
    );

    expect(docs).toContain("bun run deliverability:preflight");
    expect(docs).toContain("opensend-sns-events");
    expect(docs).toContain("X-Entity-ID");
    expect(publicDocs).toContain("bun run deliverability:preflight");
    expect(`${docs}\n${publicDocs}`).not.toContain(
      "arn:aws:sns:us-east-1:699486076867",
    );
  });
});
