import { filtersToMetadata } from "@/lib/dashboard-export-api";
import {
  type DashboardExportFilters,
  DashboardExportTooLargeError,
  createDashboardCsvExport,
  getDashboardExportSchema,
} from "@/lib/dashboard-export-service";
import {
  DASHBOARD_EXPORT_FORMAT,
  DASHBOARD_EXPORT_RETENTION_DAYS,
  type DashboardExportResource,
  type DashboardExportStatus,
  dashboardExportFilename,
} from "@/lib/dashboard-export-types";
import { db } from "@/lib/db";
import { dashboardExportJobs } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type DashboardExportJobListItem = {
  id: string;
  resource: DashboardExportResource;
  status: DashboardExportStatus;
  format: typeof DASHBOARD_EXPORT_FORMAT;
  schemaVersion: number;
  filters: Record<string, string | number | boolean | null>;
  filename: string;
  rowCount: number;
  byteSize: number;
  error: string | null;
  createdByUserId: string;
  createdByEmail: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
  downloadedAt: string | null;
  downloadCount: number;
};

export class DashboardExportJobNotFoundError extends Error {
  readonly code = "export_not_found" as const;

  constructor() {
    super("Export job not found");
    this.name = "DashboardExportJobNotFoundError";
  }
}

export class DashboardExportExpiredError extends Error {
  readonly code = "export_expired" as const;

  constructor() {
    super("Export download has expired");
    this.name = "DashboardExportExpiredError";
  }
}

export class DashboardExportNotReadyError extends Error {
  readonly code = "export_not_ready" as const;

  constructor() {
    super("Export is not ready to download");
    this.name = "DashboardExportNotReadyError";
  }
}

function expiresAtFrom(now: Date): Date {
  return new Date(
    now.getTime() + DASHBOARD_EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

function statusFor(row: {
  status: string;
  expiresAt: Date;
}): DashboardExportStatus {
  if (row.status === "completed" && row.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }
  return row.status === "failed" ? "failed" : "completed";
}

function mapJob(
  row: typeof dashboardExportJobs.$inferSelect,
): DashboardExportJobListItem {
  return {
    id: row.id,
    resource: row.resource as DashboardExportResource,
    status: statusFor(row),
    format: DASHBOARD_EXPORT_FORMAT,
    schemaVersion: row.schemaVersion,
    filters: row.filters,
    filename: row.filename,
    rowCount: row.rowCount,
    byteSize: row.byteSize,
    error: row.error,
    createdByUserId: row.createdByUserId,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    downloadedAt: row.downloadedAt?.toISOString() ?? null,
    downloadCount: row.downloadCount,
  };
}

export async function listDashboardExportJobs(input: {
  userId: string;
  limit?: number;
}): Promise<DashboardExportJobListItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await db
    .select()
    .from(dashboardExportJobs)
    .where(eq(dashboardExportJobs.userId, input.userId))
    .orderBy(desc(dashboardExportJobs.createdAt))
    .limit(limit);

  return rows.map(mapJob);
}

async function insertFailedExportJob(input: {
  userId: string;
  createdByUserId: string;
  createdByEmail?: string | null;
  resource: DashboardExportResource;
  filters: DashboardExportFilters;
  error: string;
  now: Date;
}): Promise<DashboardExportJobListItem> {
  const [row] = await db
    .insert(dashboardExportJobs)
    .values({
      userId: input.userId,
      createdByUserId: input.createdByUserId,
      createdByEmail: input.createdByEmail ?? null,
      resource: input.resource,
      status: "failed",
      format: DASHBOARD_EXPORT_FORMAT,
      schemaVersion: getDashboardExportSchema(input.resource).version,
      filters: filtersToMetadata(input.filters),
      filename: dashboardExportFilename(input.resource, input.now),
      content: null,
      rowCount: 0,
      byteSize: 0,
      error: input.error,
      completedAt: input.now,
      expiresAt: expiresAtFrom(input.now),
    })
    .returning();

  return mapJob(row);
}

export async function createDashboardExportJob(input: {
  userId: string;
  createdByUserId: string;
  createdByEmail?: string | null;
  resource: DashboardExportResource;
  filters: DashboardExportFilters;
  now?: Date;
}): Promise<DashboardExportJobListItem> {
  const now = input.now ?? new Date();
  try {
    const csvExport = await createDashboardCsvExport({
      resource: input.resource,
      userId: input.userId,
      filters: input.filters,
    });
    const csv = csvExport.csv;
    const filename = dashboardExportFilename(input.resource, now);
    const [row] = await db
      .insert(dashboardExportJobs)
      .values({
        userId: input.userId,
        createdByUserId: input.createdByUserId,
        createdByEmail: input.createdByEmail ?? null,
        resource: input.resource,
        status: "completed",
        format: DASHBOARD_EXPORT_FORMAT,
        schemaVersion: getDashboardExportSchema(input.resource).version,
        filters: filtersToMetadata(input.filters),
        filename,
        content: csv,
        rowCount: csvExport.rowCount,
        byteSize: Buffer.byteLength(csv, "utf8"),
        error: null,
        completedAt: now,
        expiresAt: expiresAtFrom(now),
      })
      .returning();

    return mapJob(row);
  } catch (error) {
    if (error instanceof DashboardExportTooLargeError) {
      return insertFailedExportJob({
        userId: input.userId,
        createdByUserId: input.createdByUserId,
        createdByEmail: input.createdByEmail,
        resource: input.resource,
        filters: input.filters,
        error: error.message,
        now,
      });
    }
    throw error;
  }
}

export async function getDashboardExportJob(input: {
  userId: string;
  id: string;
}): Promise<DashboardExportJobListItem> {
  const [row] = await db
    .select()
    .from(dashboardExportJobs)
    .where(
      and(
        eq(dashboardExportJobs.id, input.id),
        eq(dashboardExportJobs.userId, input.userId),
      ),
    )
    .limit(1);

  if (!row) throw new DashboardExportJobNotFoundError();
  return mapJob(row);
}

export async function getDashboardExportJobDownload(input: {
  userId: string;
  id: string;
}): Promise<{ filename: string; csv: string; rowCount: number }> {
  const [row] = await db
    .select()
    .from(dashboardExportJobs)
    .where(
      and(
        eq(dashboardExportJobs.id, input.id),
        eq(dashboardExportJobs.userId, input.userId),
      ),
    )
    .limit(1);

  if (!row) throw new DashboardExportJobNotFoundError();
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new DashboardExportExpiredError();
  }
  if (row.status !== "completed" || !row.content) {
    throw new DashboardExportNotReadyError();
  }

  await db
    .update(dashboardExportJobs)
    .set({
      downloadedAt: new Date(),
      downloadCount: sql`${dashboardExportJobs.downloadCount} + 1`,
    })
    .where(
      and(
        eq(dashboardExportJobs.id, input.id),
        eq(dashboardExportJobs.userId, input.userId),
      ),
    );

  return { filename: row.filename, csv: row.content, rowCount: row.rowCount };
}
