export type RootApiAlias =
  | "contacts"
  | "segments"
  | "audiences"
  | "topics"
  | "contact-properties";

export const rootApiAliasHeaderName = "x-opensend-root-api-alias";

export function getRootApiAlias(headers: Headers): RootApiAlias | null {
  const value = headers.get(rootApiAliasHeaderName);
  if (
    value === "contacts" ||
    value === "segments" ||
    value === "audiences" ||
    value === "topics" ||
    value === "contact-properties"
  ) {
    return value;
  }

  return null;
}

export function isRootApiAlias(headers: Headers, alias: RootApiAlias): boolean {
  return getRootApiAlias(headers) === alias;
}
