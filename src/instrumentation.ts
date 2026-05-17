export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupChecks } = await import("./lib/startup-checks");
    runStartupChecks();
  }
}
