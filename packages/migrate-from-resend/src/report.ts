import { countFindingsByStatus, detectorKindLabel } from "./scanner";
import type { Finding, ReportOptions, RequestPlan, ScanResult } from "./types";

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function statusLabel(status: Finding["entry"]["status"]): string {
  switch (status) {
    case "full":
      return "full";
    case "partial":
      return "partial";
    case "unsupported":
      return "unsupported";
    case "unknown":
      return "unknown";
  }
}

function renderFindingsTable(findings: readonly Finding[]): string[] {
  if (findings.length === 0) {
    return [
      "No Resend SDK imports, SDK calls, raw API endpoints, or Resend environment variables were detected.",
    ];
  }

  const lines = [
    "| Status | Kind | Resend usage | OpenSend mapping | Location | Caveat |",
    "|---|---|---|---|---|---|",
  ];

  for (const finding of findings) {
    lines.push(
      `| ${statusLabel(finding.entry.status)} | ${detectorKindLabel(
        finding.detectorKind,
      )} | ${escapeMarkdown(finding.entry.resend)} | ${escapeMarkdown(
        finding.entry.opensend,
      )} | ${escapeMarkdown(
        `${finding.location.filePath}:${finding.location.line}:${finding.location.column}`,
      )} | ${escapeMarkdown(finding.entry.caveats)} |`,
    );
  }

  return lines;
}

function renderEvidence(findings: readonly Finding[]): string[] {
  const evidence = [
    ...new Set(findings.map((finding) => finding.entry.evidence)),
  ].sort((a, b) => a.localeCompare(b));
  if (evidence.length === 0)
    return [
      "- No compatibility evidence was needed because no usage was detected.",
    ];
  return evidence.map((item) => `- ${item}`);
}

function renderRequestPlan(plan: RequestPlan): string[] {
  const lines = [
    `### ${plan.label}`,
    "",
    `- Status: \`${plan.status}\``,
    `- Method: \`${plan.method}\``,
    `- URL: \`${plan.url}\``,
    `- Safety: ${plan.safety}`,
    `- Caveat: ${plan.caveat}`,
    "",
    "```http",
    `${plan.method} ${plan.url}`,
  ];

  for (const [name, value] of Object.entries(plan.headers)) {
    lines.push(`${name}: ${value}`);
  }

  lines.push("```");

  if (plan.body !== undefined) {
    lines.push("", "```json", JSON.stringify(plan.body, null, 2), "```");
  }

  return lines;
}

export function renderMarkdownReport(
  scan: ScanResult,
  options: ReportOptions,
): string {
  const counts = countFindingsByStatus(scan.findings);
  const baseUrl = options.baseUrl ?? "$OPENSEND_BASE_URL";
  const lines = [
    "# OpenSend migration compatibility report",
    "",
    `Generated: ${scan.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Target directory: \`${scan.targetDir}\``,
    `- Files scanned: ${scan.scannedFiles}`,
    `- Findings: ${scan.findings.length}`,
    `- Full: ${counts.full}`,
    `- Partial: ${counts.partial}`,
    `- Unsupported: ${counts.unsupported}`,
    `- Unknown: ${counts.unknown}`,
    "",
    "Static scan is advisory. Treat `partial`, `unsupported`, and `unknown` findings as migration work items, and verify runtime behavior with your own sandbox tests before production cutover.",
    "",
    "## Discovered usage",
    "",
    ...renderFindingsTable(scan.findings),
    "",
    "## Environment and endpoint diff",
    "",
    "| Resend | OpenSend | Notes |",
    "|---|---|---|",
    "| `RESEND_API_KEY` / `re_...` | `OPENSEND_API_KEY` / `os_...` | Use an OpenSend API key. Never commit either value. |",
    `| \`https://api.resend.com\` | \`${baseUrl}\` | Set your SDK/client base URL to the OpenSend deployment you will test. |`,
    "| `resend` package import | `opensend` package import with `Resend` compatibility class | Static scan reports imports, but this v1 does not rewrite source code. |",
    "",
    "## Sandbox dry-run request plan",
    "",
  ];

  if (options.sandboxPlans && options.sandboxPlans.length > 0) {
    lines.push(
      "The following requests were rendered for review only. The v1 verifier does not send them, does not call the network, and does not mutate contacts, domains, or emails.",
      "",
    );
    for (const plan of options.sandboxPlans) {
      lines.push(...renderRequestPlan(plan), "");
    }
  } else {
    lines.push(
      "Not requested. Re-run with `--sandbox-plan --base-url <url> --api-key <key-or-env>` to include redacted planned requests. The v1 verifier still will not execute network calls.",
      "",
    );
  }

  lines.push(
    "## Rerun commands",
    "",
    "```bash",
    options.command,
    `${options.command} --sandbox-plan --base-url "${baseUrl}" --api-key "$OPENSEND_API_KEY"`,
    "```",
    "",
    "## v1 caveats and non-goals",
    "",
    "- No codemods or automatic rewrites are performed.",
    "- No historical contacts, domains, audiences, broadcasts, or email data is migrated from Resend.",
    "- No npm publishing is part of this in-tree verifier PR.",
    "- No real email sends or customer-resource mutations are performed by the verifier.",
    "- Dynamic endpoint construction, wrapper functions, and uncommon SDK helpers may require manual review.",
    "",
    "## Compatibility evidence referenced",
    "",
    ...renderEvidence(scan.findings),
    "",
  );

  return `${lines.join("\n")}\n`;
}
