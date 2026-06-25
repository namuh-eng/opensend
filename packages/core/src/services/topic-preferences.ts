export type TopicSubscriptionPreference = {
  readonly topicId: string;
  readonly subscribed: boolean;
};

export type TopicPreferenceTopic = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly defaultSubscription: string;
  readonly visibility: string;
};

export type VisibleTopicPreference = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly visibility: "public" | "private";
  readonly subscribed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeTopicSubscriptions(
  value: unknown,
): readonly TopicSubscriptionPreference[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.topicId !== "string" ||
      typeof item.subscribed !== "boolean"
    ) {
      return [];
    }

    return [{ topicId: item.topicId, subscribed: item.subscribed }];
  });
}

export function getExplicitTopicSubscription(
  subscriptions: readonly TopicSubscriptionPreference[],
  topicId: string,
): boolean | null {
  return (
    subscriptions.find((subscription) => subscription.topicId === topicId)
      ?.subscribed ?? null
  );
}

export function isSubscribedToTopic(
  topic: Pick<TopicPreferenceTopic, "id" | "defaultSubscription">,
  subscriptions: readonly TopicSubscriptionPreference[],
): boolean {
  const explicit = getExplicitTopicSubscription(subscriptions, topic.id);
  if (explicit !== null) return explicit;
  return topic.defaultSubscription === "opt_in";
}

export function isTopicVisibleOnPreferencePage(
  topic: Pick<TopicPreferenceTopic, "id" | "visibility">,
  subscriptions: readonly TopicSubscriptionPreference[],
): boolean {
  if (topic.visibility === "public") return true;
  return getExplicitTopicSubscription(subscriptions, topic.id) !== null;
}

export function buildVisibleTopicPreferences(
  topics: readonly TopicPreferenceTopic[],
  subscriptions: readonly TopicSubscriptionPreference[],
): readonly VisibleTopicPreference[] {
  return topics
    .filter((topic) => isTopicVisibleOnPreferencePage(topic, subscriptions))
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      visibility: topic.visibility === "private" ? "private" : "public",
      subscribed: isSubscribedToTopic(topic, subscriptions),
    }));
}
