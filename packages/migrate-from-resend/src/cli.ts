#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderMarkdownReport } from "./report";
import { buildSandboxRequestPlan } from "./sandbox-plan";
import { scanResendUsage } from "./scanner";
import type { RequestPlan } from "./types";

type CliOptions = {
  targetDir?: string;
  output: string;
  stdout: boolean;
  sandboxPlan: boolean;
  baseUrl?: string;
  apiKey?: string;
  help: boolean;
};

function usage(): string {
  return `migrate-from-resend v1 compatibility verifier

Usage:
  migrate-from-resend <target-dir> [options]

Options:
  --output <path>         Markdown report path (default: migrate-from-resend-report.md)
  --stdout               Print the report to stdout instead of writing a file
  --sandbox-plan         Include redacted OpenSend sandbox request plans; no network calls are made
  --live-dry-run         Alias for --sandbox-plan; retained for issue #643 wording
  --base-url <url>       OpenSend base URL for the sandbox request plan (required with --sandbox-plan unless OPENSEND_BASE_URL is set)
  --api-key <key>        OpenSend API key used only to mark auth as provided; it is redacted
  --help                 Show this help

Environment:
  OPENSEND_BASE_URL      Fallback for --base-url
  OPENSEND_API_KEY       Fallback for --api-key

Examples:
  bun run --cwd packages/migrate-from-resend migrate-from-resend ../my-app
  bun run --cwd packages/migrate-from-resend migrate-from-resend ../my-app --sandbox-plan --base-url http://localhost:3015 --api-key "$OPENSEND_API_KEY"
`;
}

function readValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    output: "migrate-from-resend-report.md",
    stdout: false,
    sandboxPlan: false,
    help: false,
  };

  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--output":
      case "-o":
        options.output = readValue(args, index, arg);
        index += 1;
        break;
      case "--stdout":
        options.stdout = true;
        break;
      case "--sandbox-plan":
      case "--live-dry-run":
        options.sandboxPlan = true;
        break;
      case "--base-url":
        options.baseUrl = readValue(args, index, arg);
        index += 1;
        break;
      case "--api-key":
        options.apiKey = readValue(args, index, arg);
        index += 1;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  if (positional.length > 1) {
    throw new Error(
      `Expected at most one target directory, received ${positional.length}`,
    );
  }
  if (!positional[0] && !options.help) {
    throw new Error(
      "target-dir is required; pass the application repository you want to scan",
    );
  }
  options.targetDir = positional[0];

  return options;
}

async function writeReport(outputPath: string, report: string): Promise<void> {
  const resolved = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, report);
  console.error(`Wrote ${resolved}`);
}

export async function runCli(args: readonly string[]): Promise<number> {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const baseUrl = options.baseUrl ?? process.env.OPENSEND_BASE_URL;
  const apiKey = options.apiKey ?? process.env.OPENSEND_API_KEY;
  let sandboxPlans: RequestPlan[] | undefined;

  if (options.sandboxPlan) {
    if (!baseUrl) {
      throw new Error(
        "--base-url or OPENSEND_BASE_URL is required when --sandbox-plan is used",
      );
    }
    sandboxPlans = buildSandboxRequestPlan({
      baseUrl,
      apiKey,
    });
  }

  const targetDir = options.targetDir;
  if (!targetDir) {
    throw new Error("target-dir is required");
  }

  const scan = await scanResendUsage({ targetDir });
  const command = `migrate-from-resend ${targetDir}`;
  const report = renderMarkdownReport(scan, {
    command,
    baseUrl,
    sandboxPlans,
  });

  if (options.stdout) {
    process.stdout.write(report);
  } else {
    await writeReport(options.output, report);
  }

  const partialOrWorse = scan.findings.filter(
    (finding) => finding.entry.status !== "full",
  ).length;
  console.error(
    `Scanned ${scan.scannedFiles} files, found ${scan.findings.length} Resend compatibility findings (${partialOrWorse} partial/unsupported/unknown).`,
  );

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`migrate-from-resend: ${message}`);
    process.exit(1);
  });
}
