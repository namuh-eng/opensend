import { tagSchema } from "@/lib/validation/emails";

export type ParsedTagQueryParams = {
  tagName: string | null;
  tagValue: string | null;
};

export type TagQueryValidationDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

export type ParseTagQueryParamsResult =
  | { ok: true; value: ParsedTagQueryParams }
  | { ok: false; details: TagQueryValidationDetails };

function readTrimmedParam(
  params: URLSearchParams,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value === null) continue;
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

function hasParam(params: URLSearchParams, ...keys: string[]): boolean {
  return keys.some((key) => params.has(key));
}

function tagValidationError(
  fieldErrors: Record<string, string[]>,
): ParseTagQueryParamsResult {
  return {
    ok: false,
    details: {
      formErrors: [],
      fieldErrors,
    },
  };
}

export function parseTagQueryParams(
  params: URLSearchParams,
): ParseTagQueryParamsResult {
  const tagName = readTrimmedParam(params, "tag_name", "tagName");
  const tagValuePresent = hasParam(params, "tag_value", "tagValue");
  const tagValue = tagValuePresent
    ? (params.get("tag_value") ?? params.get("tagValue") ?? "").trim()
    : null;

  if (!tagName && tagValuePresent) {
    return tagValidationError({
      tag_name: ["tag_name is required when tag_value is provided."],
    });
  }

  if (!tagName) {
    return { ok: true, value: { tagName: null, tagValue: null } };
  }

  const parsed = tagSchema.safeParse({ name: tagName, value: tagValue ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const firstPath = issue.path[0];
      const field = firstPath === "value" ? "tag_value" : "tag_name";
      fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
    }
    return tagValidationError(fieldErrors);
  }

  return {
    ok: true,
    value: {
      tagName: parsed.data.name,
      tagValue: tagValuePresent ? parsed.data.value : null,
    },
  };
}
