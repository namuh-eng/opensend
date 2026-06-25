import { db } from "@/lib/db";
import { broadcasts, contacts, topics } from "@/lib/db/schema";
import {
  type VisibleTopicPreference,
  buildVisibleTopicPreferences,
  getUnsubscribePageSettings,
  normalizeTopicSubscriptions,
} from "@opensend/core";
import { and, eq } from "drizzle-orm";

type TopicSubscriptionUpdate = Array<{
  topicId: string;
  subscribed: boolean;
}>;

type PageSettings = Awaited<ReturnType<typeof getUnsubscribePageSettings>>;

export type UnsubscribeContext = {
  readonly topicId: string | null;
  readonly broadcastId: string | null;
};

export type UnsubscribePreferenceModel = {
  readonly contactId: string;
  readonly contactEmail: string;
  readonly userId: string | null;
  readonly globallyUnsubscribed: boolean;
  readonly topics: readonly VisibleTopicPreference[];
  readonly focusedTopicId: string | null;
  readonly settings: PageSettings;
};

export type PreferenceSaveResult =
  | { readonly ok: true; readonly model: UnsubscribePreferenceModel }
  | {
      readonly ok: false;
      readonly status: 404 | 400;
      readonly message: string;
    };

export type PreferenceLoadResult =
  | { readonly ok: true; readonly model: UnsubscribePreferenceModel }
  | { readonly ok: false; readonly status: 404; readonly message: string };

const DEFAULT_SETTINGS = {
  logoUrl: null,
  brandColor: "#10b981",
  headline: "Subscription preferences",
  message: "Manage which updates you receive from this sender.",
  footerText: "Powered by OpenSend",
} satisfies PageSettings;

async function loadSettings(userId: string | null): Promise<PageSettings> {
  if (!userId) return DEFAULT_SETTINGS;
  return await getUnsubscribePageSettings(userId);
}

async function resolveFocusedTopicId(
  context: UnsubscribeContext,
  userId: string,
): Promise<string | null> {
  if (context.topicId) {
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, context.topicId), eq(topics.userId, userId)),
    });
    return topic?.id ?? null;
  }

  if (!context.broadcastId) return null;

  const broadcast = await db.query.broadcasts.findFirst({
    where: and(
      eq(broadcasts.id, context.broadcastId),
      eq(broadcasts.userId, userId),
    ),
  });
  return broadcast?.topicId ?? null;
}

export async function loadUnsubscribePreferences(
  contactId: string,
  context: UnsubscribeContext,
): Promise<PreferenceLoadResult> {
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
  });

  if (!contact) {
    return {
      ok: false,
      status: 404,
      message: "We couldn't find this unsubscribe request.",
    };
  }

  const settings = await loadSettings(contact.userId);
  if (!contact.userId) {
    return {
      ok: true,
      model: {
        contactId: contact.id,
        contactEmail: contact.email,
        userId: contact.userId,
        globallyUnsubscribed: contact.unsubscribed,
        topics: [],
        focusedTopicId: null,
        settings,
      },
    };
  }

  const tenantTopics = await db.query.topics.findMany({
    where: eq(topics.userId, contact.userId),
  });

  const subscriptions = normalizeTopicSubscriptions(contact.topicSubscriptions);
  const visibleTopics = buildVisibleTopicPreferences(
    tenantTopics,
    subscriptions,
  );
  const focusedTopicId = await resolveFocusedTopicId(context, contact.userId);

  return {
    ok: true,
    model: {
      contactId: contact.id,
      contactEmail: contact.email,
      userId: contact.userId,
      globallyUnsubscribed: contact.unsubscribed,
      topics: visibleTopics,
      focusedTopicId,
      settings,
    },
  };
}

export async function unsubscribeAll(contactId: string): Promise<boolean> {
  const [updated] = await db
    .update(contacts)
    .set({ unsubscribed: true })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });

  return Boolean(updated);
}

function mergeVisibleTopicSelections(
  current: readonly TopicSubscriptionUpdate[number][],
  visibleTopics: readonly VisibleTopicPreference[],
  selectedTopicIds: ReadonlySet<string>,
): TopicSubscriptionUpdate {
  const visibleTopicIds = new Set(visibleTopics.map((topic) => topic.id));
  return [
    ...current.filter(
      (subscription) => !visibleTopicIds.has(subscription.topicId),
    ),
    ...visibleTopics.map((topic) => ({
      topicId: topic.id,
      subscribed: selectedTopicIds.has(topic.id),
    })),
  ];
}

export async function saveTopicPreferences(
  contactId: string,
  context: UnsubscribeContext,
  selectedTopicIds: ReadonlySet<string>,
): Promise<PreferenceSaveResult> {
  const loaded = await loadUnsubscribePreferences(contactId, context);
  if (!loaded.ok) return loaded;

  const visibleTopicIds = new Set(loaded.model.topics.map((topic) => topic.id));
  const hasHiddenSelection = [...selectedTopicIds].some(
    (topicId) => !visibleTopicIds.has(topicId),
  );
  if (hasHiddenSelection) {
    return {
      ok: false,
      status: 400,
      message: "One or more topic selections are not available.",
    };
  }

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
  });
  if (!contact) {
    return {
      ok: false,
      status: 404,
      message: "We couldn't find this unsubscribe request.",
    };
  }

  const current = normalizeTopicSubscriptions(contact.topicSubscriptions);
  const topicSubscriptions = mergeVisibleTopicSelections(
    current,
    loaded.model.topics,
    selectedTopicIds,
  );

  await db
    .update(contacts)
    .set({ topicSubscriptions })
    .where(eq(contacts.id, contactId));

  const model = await loadUnsubscribePreferences(contactId, context);
  if (!model.ok) return model;

  return { ok: true, model: model.model };
}
