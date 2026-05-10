import { type SQL, sql } from "drizzle-orm";

export type HealthStatusOk = {
  status: "ok";
  db: "connected";
};

export type HealthStatusError = {
  status: "error";
  db: "unreachable";
};

export type HealthStatus = HealthStatusOk | HealthStatusError;

export type HealthProbeDatabase = {
  execute(query: SQL): Promise<unknown>;
};

export type HealthServiceDependencies = {
  database: HealthProbeDatabase;
};

export type HealthService = {
  check(): Promise<HealthStatus>;
};

export function createHealthService(
  dependencies: HealthServiceDependencies,
): HealthService {
  return {
    async check() {
      try {
        await dependencies.database.execute(sql`SELECT 1`);
        return { status: "ok", db: "connected" };
      } catch {
        return { status: "error", db: "unreachable" };
      }
    },
  };
}
