import { act, cleanup, render, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));
const storageMock = vi.hoisted(() => {
  const entries = new Map<string, string>();
  return {
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
  };
});

vi.mock("posthog-js", () => ({
  default: {
    capture: posthogMock.capture,
    init: posthogMock.init,
  },
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

describe("PosthogProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    storageMock.clear();
    posthogMock.capture.mockClear();
    posthogMock.init.mockClear();
    vi.stubGlobal("localStorage", storageMock);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response('{"status":"Ok"}'))),
    );
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "test-distinct-id"),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("captures the initial browser pageview when PostHog is configured", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");

    const { PosthogProvider } = await import(
      "@/components/observability/posthog-provider"
    );

    act(() => {
      render(
        <PosthogProvider>
          <span>App</span>
        </PosthogProvider>,
      );
    });

    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        capture_pageview: "history_change",
        capture_pageleave: true,
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://us.i.posthog.com/capture/",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: expect.stringContaining('"event":"$pageview"'),
      }),
    );
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string),
    ).toEqual(
      expect.objectContaining({
        api_key: "phc_test",
        distinct_id: "test-distinct-id",
        event: "$pageview",
        properties: expect.objectContaining({
          $lib: "opensend-web",
          token: "phc_test",
        }),
      }),
    );
  });

  it("does not initialize or capture when PostHog is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    const { PosthogProvider } = await import(
      "@/components/observability/posthog-provider"
    );

    render(
      <PosthogProvider>
        <span>App</span>
      </PosthogProvider>,
    );

    await waitFor(() => {
      expect(posthogMock.init).not.toHaveBeenCalled();
      expect(posthogMock.capture).not.toHaveBeenCalled();
    });
  });
});
