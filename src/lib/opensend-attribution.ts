export const OPENSEND_HOME_URL = "https://opensend.namuh.co";
export const OPENSEND_ATTRIBUTION_TEXT = "Powered by OpenSend";

export function isOpenSendAttribution(text: string): boolean {
  return text.trim() === OPENSEND_ATTRIBUTION_TEXT;
}
