import { type ZodError, flattenError } from "zod";

export type PublicApiErrorCode =
  | "invalid_json"
  | "validation_error"
  | "missing_api_key"
  | "malformed_api_key"
  | "invalid_api_key"
  | "invalid_idempotency_key"
  | "insufficient_api_key_permission"
  | "api_key_domain_restricted"
  | "idempotency_conflict"
  | "not_found"
  | "quota_exceeded"
  | "recipient_suppressed"
  | "rate_limit_exceeded"
  | "rate_limit_unavailable"
  | "internal_server_error";

export type PublicApiErrorDetails =
  | { formErrors: string[]; fieldErrors: Record<string, string[]> }
  | Record<string, string | number | boolean | null>;

export interface PublicApiErrorEnvelope {
  name: PublicApiErrorCode;
  code: PublicApiErrorCode;
  message: string;
  statusCode: number;
  details?: PublicApiErrorDetails;
}

export function publicApiError(
  code: PublicApiErrorCode,
  message: string,
  statusCode: number,
  details?: PublicApiErrorDetails,
): PublicApiErrorEnvelope {
  return details === undefined
    ? { name: code, code, message, statusCode }
    : { name: code, code, message, statusCode, details };
}

export function publicApiErrorResponse(
  code: PublicApiErrorCode,
  message: string,
  statusCode: number,
  init?: ResponseInit & { details?: PublicApiErrorDetails },
): Response {
  const headers = new Headers(init?.headers);
  return Response.json(
    publicApiError(code, message, statusCode, init?.details),
    {
      ...init,
      status: statusCode,
      headers,
    },
  );
}

export function zodValidationDetails(error: ZodError): {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
} {
  const flattened = flattenError(error);
  const fieldErrors: Record<string, string[]> = { ...flattened.fieldErrors };

  for (const issue of error.issues) {
    if (issue.path.length < 2) continue;

    const fieldPath = issue.path.join(".");
    fieldErrors[fieldPath] = [...(fieldErrors[fieldPath] ?? []), issue.message];
  }

  return {
    formErrors: flattened.formErrors,
    fieldErrors,
  };
}
