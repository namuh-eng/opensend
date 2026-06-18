import {
  type EnvValidationIssue,
  OpenSendEnvValidationError,
  validateOpenSendEnv,
} from "@opensend/core/src/env";

function logJson(
  level: "warn" | "error",
  data: Record<string, unknown>,
  msg: string,
): void {
  const line = JSON.stringify({ level, msg, ...data });
  if (level === "error") console.error(line);
  else console.warn(line);
}

function issuePayload(issues: readonly EnvValidationIssue[]) {
  return issues.map((issue) => ({
    key: issue.key,
    message: issue.message,
  }));
}

export function runIngesterStartupChecks(): void {
  const result = validateOpenSendEnv(process.env, { service: "ingester" });

  if (result.warnings.length > 0) {
    logJson(
      "warn",
      {
        event: "security.startup.env_warning",
        issues: issuePayload(result.warnings),
      },
      "OpenSend ingester environment preflight found non-fatal configuration warnings",
    );
  }

  if (result.errors.length > 0) {
    logJson(
      "error",
      {
        event: "security.startup.env_invalid",
        issues: issuePayload(result.errors),
      },
      "OpenSend ingester environment preflight failed — refusing to boot",
    );
    throw new OpenSendEnvValidationError("ingester", result.errors);
  }
}
