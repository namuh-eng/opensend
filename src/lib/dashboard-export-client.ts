import {
  type DashboardExportResource,
  dashboardExportFilename,
} from "@/lib/dashboard-export-types";

export type DashboardCsvDownloadResult = {
  rowCount: number;
};

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const quotedMatch = /filename="([^"]+)"/i.exec(contentDisposition);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const bareMatch = /filename=([^;]+)/i.exec(contentDisposition);
  return bareMatch?.[1]?.trim() ?? null;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadDashboardCsvExport(
  resource: DashboardExportResource,
  params: URLSearchParams = new URLSearchParams(),
): Promise<DashboardCsvDownloadResult> {
  const query = params.toString();
  const response = await fetch(
    `/api/dashboard/exports/${resource}${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    let message = "Export request failed. Please try again.";
    try {
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
      ) {
        message = payload.error;
      }
    } catch {
      // Keep fallback message for non-JSON errors.
    }
    throw new Error(message);
  }

  const rowCount = Number(
    response.headers.get("x-opensend-export-rows") ?? "0",
  );
  const blob = await response.blob();
  if (rowCount > 0) {
    triggerDownload(
      blob,
      parseFilename(response.headers.get("content-disposition")) ??
        dashboardExportFilename(resource),
    );
  }

  return { rowCount };
}
