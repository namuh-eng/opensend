#!/usr/bin/env bun
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Service = "app" | "ingester" | "all";
type Level = "error" | "warning";

interface Options {
  service: Service;
  checkDb: boolean;
  strict: boolean;
  help: boolean;
}

export interface ValidationIssue {
  level: Level;
  service: Service | "database";
  key: string;
  message: string;
}

export interface PlanRow {
  id: string;
  slug: string;
  name: string;
  monthly_price_cents: number;
  stripe_price_id: string | null;
  is_public: boolean;
}

const DEFAULT_OPTIONS: Options = {
  service: "all",
  checkDb: false,
  strict: false,
  help: false,
};

const SECRET_KEYS = new Set(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);

function normaliseBackend(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function servicesFor(service: Service): Array<Exclude<Service, "all">> {
  return service === "all" ? ["app", "ingester"] : [service];
}

function envError(
  service: Exclude<Service, "all">,
  key: string,
  message: string,
): ValidationIssue {
  return { level: "error", service, key, message };
}

export function redactEnvValue(key: string, value: string | undefined): string {
  if (!isPresent(value)) return "(missing)";
  const trimmed = value.trim();
  if (!SECRET_KEYS.has(key)) return trimmed;
  if (trimmed.length <= 8) return "(set, redacted)";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function validateStripeEnvironment(
  env: Record<string, string | undefined>,
  service: Service = "all",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const backend = normaliseBackend(env.BILLING_BACKEND);

  for (const current of servicesFor(service)) {
    if (backend !== "stripe") {
      issues.push(
        envError(
          current,
          "BILLING_BACKEND",
          `Expected BILLING_BACKEND=stripe for hosted cutover; found ${redactEnvValue("BILLING_BACKEND", env.BILLING_BACKEND)}.`,
        ),
      );
    }

    if (!isPresent(env.STRIPE_SECRET_KEY)) {
      issues.push(
        envError(
          current,
          "STRIPE_SECRET_KEY",
          "STRIPE_SECRET_KEY must be set from the deployment secret manager; never commit the key.",
        ),
      );
    }

    if (current === "ingester" && !isPresent(env.STRIPE_WEBHOOK_SECRET)) {
      issues.push(
        envError(
          current,
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_WEBHOOK_SECRET must match the Stripe webhook endpoint signing secret for /webhooks/stripe.",
        ),
      );
    }
  }

  return issues;
}

export function validatePlanRows(rows: PlanRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const publicRows = rows.filter((row) => row.is_public);

  if (publicRows.length === 0) {
    issues.push({
      level: "error",
      service: "database",
      key: "plans",
      message:
        "No public plans found. Seed or create approved Free/paid plans before enabling hosted checkout.",
    });
    return issues;
  }

  const paidPublicRows = publicRows.filter(
    (row) => row.monthly_price_cents > 0,
  );
  if (paidPublicRows.length === 0) {
    issues.push({
      level: "warning",
      service: "database",
      key: "plans.stripe_price_id",
      message:
        "No paid public plans found. Stripe checkout cannot be validated until approved paid tiers and Price IDs are seeded.",
    });
  }

  const seenPriceIds = new Map<string, string>();
  for (const row of publicRows) {
    const priceId = row.stripe_price_id?.trim() ?? "";
    const label = `${row.slug} (${row.name})`;

    if (row.monthly_price_cents > 0 && !priceId) {
      issues.push({
        level: "error",
        service: "database",
        key: `plans.${row.slug}.stripe_price_id`,
        message: `${label} is a paid public plan but has no Stripe Price ID.`,
      });
      continue;
    }

    if (priceId && !priceId.startsWith("price_")) {
      issues.push({
        level: "error",
        service: "database",
        key: `plans.${row.slug}.stripe_price_id`,
        message: `${label} uses ${priceId}, which does not look like a Stripe Price ID (price_...).`,
      });
    }

    if (row.monthly_price_cents === 0 && priceId) {
      issues.push({
        level: "warning",
        service: "database",
        key: `plans.${row.slug}.stripe_price_id`,
        message: `${label} is free but has a Stripe Price ID. Free signup should not require Stripe Checkout.`,
      });
    }

    if (priceId) {
      const firstSlug = seenPriceIds.get(priceId);
      if (firstSlug) {
        issues.push({
          level: "error",
          service: "database",
          key: "plans.stripe_price_id",
          message: `${row.slug} and ${firstSlug} both use ${priceId}; each paid tier should map to one approved Stripe Price ID.`,
        });
      } else {
        seenPriceIds.set(priceId, row.slug);
      }
    }
  }

  return issues;
}

function parseArgs(argv: string[]): Options {
  const options = { ...DEFAULT_OPTIONS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--check-db") {
      options.checkDb = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--service") {
      const value = argv[index + 1];
      if (value !== "app" && value !== "ingester" && value !== "all") {
        throw new Error("--service must be app, ingester, or all");
      }
      options.service = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp(): void {
  console.log(`OpenSend hosted Stripe cutover preflight

Usage:
  bun src/lib/billing/cutover-preflight.ts [--service app|ingester|all] [--check-db] [--strict]

Checks:
  - Hosted Stripe env intent: BILLING_BACKEND=stripe plus required STRIPE_* keys.
  - Optional DB plan mapping: public paid plans must have unique price_... IDs.

Notes:
  - This script never prints Stripe secrets.
  - Use --strict to fail on warnings as well as errors.
  - Set DATABASE_URL before --check-db.
`);
}

function printIssues(issues: ValidationIssue[]): void {
  if (issues.length === 0) {
    console.log("✓ No preflight issues found");
    return;
  }

  for (const issue of issues) {
    const marker = issue.level === "error" ? "✗" : "!";
    console.log(
      `${marker} [${issue.level}] ${issue.service}:${issue.key} — ${issue.message}`,
    );
  }
}

async function loadPublicPlans(connectionString: string): Promise<PlanRow[]> {
  const needsSsl = connectionString.includes("amazonaws.com");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const result = await pool.query(
      `select id, slug, name, monthly_price_cents, stripe_price_id, is_public
       from plans
       where is_public = true
       order by monthly_price_cents asc, slug asc`,
    );
    return result.rows as PlanRow[];
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile?.(".env");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code !== "ENOENT") throw error;
  }

  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const issues = validateStripeEnvironment(process.env, options.service);

  console.log("Hosted Stripe env preflight");
  console.log(
    `  BILLING_BACKEND=${redactEnvValue("BILLING_BACKEND", process.env.BILLING_BACKEND)}`,
  );
  console.log(
    `  STRIPE_SECRET_KEY=${redactEnvValue("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY)}`,
  );
  if (options.service === "ingester" || options.service === "all") {
    console.log(
      `  STRIPE_WEBHOOK_SECRET=${redactEnvValue("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET)}`,
    );
  }

  if (options.checkDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!isPresent(connectionString)) {
      issues.push({
        level: "error",
        service: "database",
        key: "DATABASE_URL",
        message: "DATABASE_URL is required when --check-db is used.",
      });
    } else {
      const plans = await loadPublicPlans(connectionString);
      console.log(`  Loaded ${plans.length} public plan(s) from DATABASE_URL`);
      for (const plan of plans) {
        console.log(
          `    - ${plan.slug}: $${(plan.monthly_price_cents / 100).toFixed(2)}/mo, stripe_price_id=${plan.stripe_price_id ?? "(none)"}`,
        );
      }
      issues.push(...validatePlanRows(plans));
    }
  }

  printIssues(issues);
  const hasError = issues.some((issue) => issue.level === "error");
  const hasWarning = issues.some((issue) => issue.level === "warning");
  if (hasError || (options.strict && hasWarning)) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
