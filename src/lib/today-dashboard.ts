type HeaderReader = Pick<Headers, "get">;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function envUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  return raw ? stripTrailingSlash(raw) : null;
}

export function getTodayApiBaseUrl(headers?: HeaderReader): string {
  const configured = envUrl();
  if (configured) return configured;

  const host =
    headers?.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers?.get("host")?.trim() ||
    "";
  if (!host) return "http://localhost:3015";

  const proto =
    headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

export type TodayChartSummaryInput = {
  total: number;
  hourly: Array<{ sent: number }>;
};

export type TodayChartSummary = {
  total: number;
  peak: number;
  label: string;
};

export function getTodayChartSummary({
  total,
  hourly,
}: TodayChartSummaryInput): TodayChartSummary {
  const peak = Math.max(1, ...hourly.map((bucket) => bucket.sent));
  return {
    total,
    peak,
    label: `${total.toLocaleString()} send${
      total === 1 ? "" : "s"
    } · peak ${peak.toLocaleString()}`,
  };
}
