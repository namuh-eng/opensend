import {
  type AuthResult,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";

type PublicAutomationAuthResult =
  | { ok: true; auth: AuthResult & { userId: string } }
  | { ok: false; response: Response };

export async function authorizePublicAutomationRoute(
  request: Request,
): Promise<PublicAutomationAuthResult> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return { ok: false, response: unauthorizedResponse() };

  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return { ok: false, response: permissionError };
  if (!auth.userId) return { ok: false, response: unauthorizedResponse() };

  return { ok: true, auth: { ...auth, userId: auth.userId } };
}
