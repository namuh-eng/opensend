export const IDEMPOTENCY_KEY_WINDOW_HOURS = 24;
export const IDEMPOTENCY_KEY_WINDOW_MS =
  IDEMPOTENCY_KEY_WINDOW_HOURS * 60 * 60 * 1000;

export function getIdempotencyWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - IDEMPOTENCY_KEY_WINDOW_MS);
}
