/**
 * Simple Mustache-style variable extractor.
 * Finds all unique {{variable}} and {{{variable}}} patterns in a string.
 */
export function extractTemplateVariables(content: string): string[] {
  const regex = /{{{\s*([a-zA-Z0-9_-]+)\s*}}}|{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    const variableName = match[1] ?? match[2];
    if (variableName) {
      variables.add(variableName);
    }
    match = regex.exec(content);
  }

  return Array.from(variables);
}
