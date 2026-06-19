export { compatibilityMatrix, unknownCompatibilityEntry } from "./matrix";
export { renderMarkdownReport } from "./report";
export { buildSandboxRequestPlan } from "./sandbox-plan";
export { countFindingsByStatus, scanResendUsage } from "./scanner";
export type {
  CompatibilityEntry,
  CompatibilityStatus,
  DetectorKind,
  Finding,
  ReportOptions,
  RequestPlan,
  SandboxPlanOptions,
  ScanOptions,
  ScanResult,
} from "./types";
