import { describe, expect, it } from "vitest";
import {
  getExplicitTopicSubscription,
  isSubscribedToTopic,
  isTopicVisibleOnPreferencePage,
  normalizeTopicSubscriptions,
} from "../packages/core/src/services/topic-preferences";

const publicOptInTopic = {
  id: "topic-public-opt-in",
  name: "Product updates",
  description: null,
  defaultSubscription: "opt_in",
  visibility: "public",
} as const;

const privateOptOutTopic = {
  id: "topic-private-opt-out",
  name: "Partner offers",
  description: null,
  defaultSubscription: "opt_out",
  visibility: "private",
} as const;

describe("topic preference helpers", () => {
  it("uses explicit topic subscription before default subscription", () => {
    const subscriptions = normalizeTopicSubscriptions([
      { topicId: "topic-public-opt-in", subscribed: false },
      { topicId: "topic-private-opt-out", subscribed: true },
    ]);

    expect(isSubscribedToTopic(publicOptInTopic, subscriptions)).toBe(false);
    expect(isSubscribedToTopic(privateOptOutTopic, subscriptions)).toBe(true);
  });

  it("falls back to topic default subscription when contact has no explicit row", () => {
    expect(isSubscribedToTopic(publicOptInTopic, [])).toBe(true);
    expect(isSubscribedToTopic(privateOptOutTopic, [])).toBe(false);
  });

  it("normalizes malformed topic subscriptions to valid explicit preferences only", () => {
    const subscriptions = normalizeTopicSubscriptions([
      { topicId: "topic-1", subscribed: true },
      { topicId: "topic-2", subscribed: "yes" },
      { id: "topic-3", subscribed: false },
      null,
    ]);

    expect(subscriptions).toEqual([{ topicId: "topic-1", subscribed: true }]);
    expect(getExplicitTopicSubscription(subscriptions, "topic-2")).toBeNull();
  });

  it("shows public topics to every signed contact and private topics only with explicit preferences", () => {
    const subscriptions = normalizeTopicSubscriptions([
      { topicId: "topic-private-opt-out", subscribed: false },
    ]);

    expect(isTopicVisibleOnPreferencePage(publicOptInTopic, [])).toBe(true);
    expect(isTopicVisibleOnPreferencePage(privateOptOutTopic, [])).toBe(false);
    expect(
      isTopicVisibleOnPreferencePage(privateOptOutTopic, subscriptions),
    ).toBe(true);
  });
});
