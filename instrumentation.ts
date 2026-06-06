/**
 * Next.js boots this once per server process. We use it to arm the in-process
 * weekly-blog scheduler. Skipped at edge runtime — the scheduler relies on
 * Node-only modules (node-cron, pg, fs).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("@/lib/scheduler");
  try {
    await startScheduler();
  } catch (err) {
    console.error("[instrumentation] scheduler boot failed:", err);
  }
}
