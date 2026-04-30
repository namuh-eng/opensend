import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[migrate] DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Migrations complete.");
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;

  console.error(
    "[migrate] Migration failed.",
    JSON.stringify({ code, message }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
