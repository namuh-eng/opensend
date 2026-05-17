const SNS_SUBSCRIBE_URL_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/**
 * Restrict SNS SubscriptionConfirmation callbacks to the AWS SNS host pattern
 * so an attacker who can spoof or replay SNS envelopes cannot point the
 * `SubscribeURL` fetch at an arbitrary external endpoint.
 */
export function isAllowedSnsSubscribeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return SNS_SUBSCRIBE_URL_HOST.test(url.hostname.toLowerCase());
}
