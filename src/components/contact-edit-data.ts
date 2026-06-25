export type SegmentOption = {
  readonly id: string;
  readonly name: string;
};

export type TopicSubscription = "opt_in" | "opt_out";

export type TopicOption = {
  readonly id: string;
  readonly name: string;
  readonly defaultSubscription: TopicSubscription;
};

export type EditableTopic = TopicOption & {
  readonly subscription: TopicSubscription;
};

export type PropertyRow = {
  readonly rowId: string;
  readonly key: string;
  readonly value: string;
};

function readField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function readListPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const data = readField(payload, "data");
  return Array.isArray(data) ? data : [];
}

export function extractSegments(payload: unknown): SegmentOption[] {
  return readListPayload(payload).flatMap((item) => {
    const id = readField(item, "id");
    const name = readField(item, "name");
    if (typeof id !== "string" || typeof name !== "string") return [];
    return [{ id, name }];
  });
}

export function extractTopics(payload: unknown): TopicOption[] {
  return readListPayload(payload).flatMap((item) => {
    const id = readField(item, "id");
    const name = readField(item, "name");
    if (typeof id !== "string" || typeof name !== "string") return [];

    const rawDefault =
      readField(item, "defaultSubscription") ??
      readField(item, "default_subscription");
    return [
      {
        id,
        name,
        defaultSubscription: rawDefault === "opt_in" ? "opt_in" : "opt_out",
      },
    ];
  });
}

export function createPropertyRows(
  properties: Record<string, string>,
): PropertyRow[] {
  return Object.entries(properties).map(([key, value], index) => ({
    rowId: `property-${index}-${key}`,
    key,
    value,
  }));
}

export function rowsToProperties(
  rows: readonly PropertyRow[],
): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.key.trim();
    if (key) acc[key] = row.value;
    return acc;
  }, {});
}

export function reconcileSegments(
  selected: readonly SegmentOption[],
  available: readonly SegmentOption[],
): SegmentOption[] {
  return selected.map((segment) => {
    return (
      available.find(
        (candidate) =>
          candidate.id === segment.id || candidate.name === segment.name,
      ) ?? segment
    );
  });
}

export function reconcileTopics(
  selected: readonly EditableTopic[],
  available: readonly TopicOption[],
): EditableTopic[] {
  const selectedById = new Map(selected.map((topic) => [topic.id, topic]));
  return available.map((topic) => {
    const selectedTopic = selectedById.get(topic.id);
    return {
      ...topic,
      subscription: selectedTopic?.subscription ?? topic.defaultSubscription,
    };
  });
}

export function diffIds(
  before: readonly string[],
  after: readonly string[],
): { readonly added: string[]; readonly removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((id) => !beforeSet.has(id)),
    removed: before.filter((id) => !afterSet.has(id)),
  };
}
