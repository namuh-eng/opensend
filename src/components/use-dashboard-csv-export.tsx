"use client";

import { downloadDashboardCsvExport } from "@/lib/dashboard-export-client";
import {
  type DashboardExportResource,
  dashboardExportLabel,
} from "@/lib/dashboard-export-types";
import { useCallback, useState } from "react";

export type DashboardCsvExportState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "empty"; message: string }
  | { type: "error"; message: string };

export function useDashboardCsvExport(resource: DashboardExportResource) {
  const label = dashboardExportLabel(resource);
  const [exportState, setExportState] = useState<DashboardCsvExportState>({
    type: "idle",
    message: "",
  });

  const exportCsv = useCallback(
    async (params: URLSearchParams = new URLSearchParams()) => {
      setExportState({
        type: "loading",
        message: `Preparing ${label} export…`,
      });

      try {
        const result = await downloadDashboardCsvExport(resource, params);
        if (result.rowCount === 0) {
          setExportState({
            type: "empty",
            message: `No ${label} match these filters.`,
          });
          return;
        }

        setExportState({
          type: "success",
          message: `Exported ${result.rowCount} ${label} row${
            result.rowCount === 1 ? "" : "s"
          }.`,
        });
      } catch (error) {
        setExportState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Export request failed. Please try again.",
        });
      }
    },
    [label, resource],
  );

  return { exportState, exportCsv };
}

export function ExportStatusMessage({
  state,
}: {
  state: DashboardCsvExportState;
}) {
  if (!state.message) return null;

  return (
    <p
      className={`text-[12px] ${
        state.type === "error" ? "text-red" : "text-fg-2"
      }`}
      role={state.type === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}
