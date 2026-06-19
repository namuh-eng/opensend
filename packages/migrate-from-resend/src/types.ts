export type CompatibilityStatus =
  | "full"
  | "partial"
  | "unsupported"
  | "unknown";

export type DetectorKind =
  | "sdk-call"
  | "sdk-import"
  | "rest-endpoint"
  | "environment";

export type CompatibilityEntry = {
  id: string;
  detectorKind: DetectorKind;
  resend: string;
  opensend: string;
  status: CompatibilityStatus;
  evidence: string;
  caveats: string;
  sdkPatterns?: readonly RegExp[];
  restPatterns?: readonly RegExp[];
  envPatterns?: readonly RegExp[];
};

export type SourceLocation = {
  filePath: string;
  line: number;
  column: number;
};

export type Finding = {
  id: string;
  detectorKind: DetectorKind;
  location: SourceLocation;
  match: string;
  entry: CompatibilityEntry;
};

export type ScanOptions = {
  targetDir: string;
  cwd?: string;
};

export type ScanResult = {
  targetDir: string;
  scannedFiles: number;
  findings: Finding[];
  generatedAt: string;
};

export type RequestPlan = {
  id: string;
  label: string;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  status: "planned-not-sent";
  safety: string;
  caveat: string;
};

export type SandboxPlanOptions = {
  baseUrl: string;
  apiKey?: string;
};

export type ReportOptions = {
  command: string;
  baseUrl?: string;
  sandboxPlans?: readonly RequestPlan[];
};
