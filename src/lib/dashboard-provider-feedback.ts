import {
  SES_EVENTS_MATCHING_EVENT_TYPES,
  configurationSetService,
  getSesEventsSnsTopicArn,
} from "@opensend/core";

export type ProviderFeedbackCandidate = {
  id: string;
  name: string;
  region: string;
  configurationSetName: string | null;
};

export type ProviderFeedbackDestinationState = {
  configured: boolean;
  enabled: boolean | null;
  topicArn: string | null;
  matchingEventTypes: string[];
};

export type ProviderFeedbackStateReader = (input: {
  configurationSetName: string;
  region?: string;
}) => Promise<ProviderFeedbackDestinationState>;

const DEFAULT_PROVIDER_FEEDBACK_CACHE_TTL_MS = 30_000;
const providerFeedbackWiringCache = new Map<
  string,
  { expiresAt: number; promise: Promise<boolean> }
>();

export function clearProviderFeedbackWiringCache(): void {
  providerFeedbackWiringCache.clear();
}

export function isSesEventsDestinationWired(
  state: ProviderFeedbackDestinationState | null,
  expectedTopicArn: string | null,
): boolean {
  if (!expectedTopicArn || !state?.configured || state.enabled !== true) {
    return false;
  }
  if (state.topicArn !== expectedTopicArn) {
    return false;
  }
  return SES_EVENTS_MATCHING_EVENT_TYPES.every((eventType) =>
    state.matchingEventTypes.includes(eventType),
  );
}

export function areAllRecentSenderDomainsWired(
  candidates: ProviderFeedbackCandidate[],
  wiredByDomain: Map<string, boolean>,
): boolean {
  return (
    candidates.length > 0 &&
    candidates.every((candidate) => wiredByDomain.get(candidate.id) === true)
  );
}

export async function resolveProviderFeedbackWiring(
  candidates: ProviderFeedbackCandidate[],
  options: {
    topicArn?: string | null;
    cacheTtlMs?: number;
    readState?: ProviderFeedbackStateReader;
    onReadError?: (
      candidate: ProviderFeedbackCandidate,
      error: unknown,
    ) => void;
  } = {},
): Promise<Map<string, boolean>> {
  const topicArn = options.topicArn ?? getSesEventsSnsTopicArn();
  const readState =
    options.readState ??
    ((input) =>
      configurationSetService.getConfigurationSetEventDestinationState(input));
  const cacheTtlMs =
    options.cacheTtlMs ?? DEFAULT_PROVIDER_FEEDBACK_CACHE_TTL_MS;
  const now = Date.now();
  for (const [cacheKey, cached] of providerFeedbackWiringCache) {
    if (cached.expiresAt <= now) {
      providerFeedbackWiringCache.delete(cacheKey);
    }
  }
  const wiredByDomain = new Map<string, boolean>();
  const wiredByConfigSet = new Map<string, Promise<boolean>>();
  const assignments: Array<Promise<void>> = [];

  for (const candidate of candidates) {
    const configSetName = candidate.configurationSetName?.trim() || null;
    if (!topicArn || !configSetName) {
      wiredByDomain.set(candidate.id, false);
      continue;
    }

    const cacheKey = `${topicArn}:${candidate.region}:${configSetName}`;
    let statePromise = wiredByConfigSet.get(cacheKey);
    if (!statePromise) {
      const cached =
        cacheTtlMs > 0 ? providerFeedbackWiringCache.get(cacheKey) : undefined;
      if (cached && cached.expiresAt > now) {
        statePromise = cached.promise;
      } else {
        const readPromise = readState({
          configurationSetName: configSetName,
          region: candidate.region,
        }).then((state) => isSesEventsDestinationWired(state, topicArn));
        if (cacheTtlMs > 0) {
          readPromise.then(
            (wired) => {
              providerFeedbackWiringCache.set(cacheKey, {
                expiresAt: Date.now() + cacheTtlMs,
                promise: Promise.resolve(wired),
              });
            },
            () => {
              providerFeedbackWiringCache.delete(cacheKey);
            },
          );
        }
        statePromise = readPromise.catch((error) => {
          options.onReadError?.(candidate, error);
          return false;
        });
      }
      wiredByConfigSet.set(cacheKey, statePromise);
    }
    assignments.push(
      statePromise.then((wired) => {
        wiredByDomain.set(candidate.id, wired);
      }),
    );
  }

  await Promise.all(assignments);

  return wiredByDomain;
}
