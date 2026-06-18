import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import {
  type ExternalEnvKey,
  createGeneratedOpenSendEnv,
  renderOpenSendEnvFile,
  validateOpenSendEnv,
} from "../../../packages/core/src/env";

type CliOptions = {
  output: string;
  force: boolean;
  yes: boolean;
  appUrl?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: ".env",
    force: false,
    yes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error("--output requires a path");
      options.output = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
      continue;
    }
    if (arg === "--app-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--app-url requires a URL");
      options.appUrl = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--app-url=")) {
      options.appUrl = arg.slice("--app-url=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp(): void {
  console.log(
    "Generate a complete OpenSend .env with fresh local secrets.\n\nUsage:\n  bun run setup [-- --output .env] [-- --force] [-- --yes] [-- --app-url http://localhost:3015]\n\nOptions:\n  --output <path>  File to write. Defaults to .env\n  --force          Overwrite the output file if it already exists\n  --yes, -y        Non-interactive mode; leave external provider values blank\n  --app-url <url>  BETTER_AUTH_URL/NEXT_PUBLIC_APP_URL/trusted origin default\n",
  );
}
async function promptExternalValues(
  appUrl: string,
): Promise<Partial<Record<ExternalEnvKey, string>>> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    return { AWS_REGION: "us-east-1" };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log(
      "OpenSend will generate local secrets now. External provider values can be left blank and filled in later.",
    );
    console.log(`Using ${appUrl} as the default app URL.\n`);
    const ask = async (label: string, defaultValue = ""): Promise<string> => {
      const suffix = defaultValue ? ` (${defaultValue})` : "";
      const answer = await rl.question(`${label}${suffix}: `);
      return answer.trim() || defaultValue;
    };

    return {
      AWS_ACCESS_KEY_ID: await ask("AWS_ACCESS_KEY_ID"),
      AWS_SECRET_ACCESS_KEY: await ask("AWS_SECRET_ACCESS_KEY"),
      AWS_REGION: await ask("AWS_REGION", "us-east-1"),
      S3_BUCKET_NAME: await ask("S3_BUCKET_NAME"),
      CLOUDFLARE_API_TOKEN: await ask("CLOUDFLARE_API_TOKEN"),
      CLOUDFLARE_ZONE_ID: await ask("CLOUDFLARE_ZONE_ID"),
      GOOGLE_CLIENT_ID: await ask("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: await ask("GOOGLE_CLIENT_SECRET"),
    };
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), options.output);

  if (existsSync(outputPath) && !options.force) {
    throw new Error(
      `${options.output} already exists. Re-run with -- --force to overwrite it, or choose -- --output <path>.`,
    );
  }

  const appUrl = options.appUrl?.trim() || "http://localhost:3015";
  const external = options.yes
    ? { AWS_REGION: "us-east-1" }
    : await promptExternalValues(appUrl);
  const env = createGeneratedOpenSendEnv({ appUrl, external });

  const appValidation = validateOpenSendEnv(
    { ...env, NODE_ENV: "production" },
    { service: "app", production: true },
  );
  const ingesterValidation = validateOpenSendEnv(
    { ...env, NODE_ENV: "production" },
    { service: "ingester", production: true },
  );
  const schedulerValidation = validateOpenSendEnv(
    {
      ...env,
      NODE_ENV: "production",
      INGESTER_URL: "http://ingester:3016",
      DATABASE_URL: "postgresql://opensend:generated@postgres:5432/opensend",
    },
    { service: "scheduler", production: true },
  );
  const errors = [
    ...appValidation.errors,
    ...ingesterValidation.errors,
    ...schedulerValidation.errors,
  ];
  if (errors.length > 0) {
    throw new Error(
      `Generated .env failed internal validation for keys: ${errors.map((issue) => issue.key).join(", ")}`,
    );
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderOpenSendEnvFile(env), { mode: 0o600 });
  console.log(`Wrote ${options.output} with generated OpenSend secrets.`);
  console.log(
    "Fill in external provider values (AWS, Cloudflare, Google OAuth) before using those integrations.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
