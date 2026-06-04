import { cleanup, render, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

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
    posthogMock.capture.mockClear();
    posthogMock.init.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("captures the initial browser pageview when PostHog is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");

    const { PosthogProvider } = await import(
      "@/components/observability/posthog-provider"
    );

    render(
      <PosthogProvider>
        <span>App</span>
      </PosthogProvider>,
    );

    await waitFor(() => {
      expect(posthogMock.init).toHaveBeenCalledWith(
        "phc_test",
        expect.objectContaining({
          capture_pageview: "history_change",
          capture_pageleave: true,
          loaded: expect.any(Function),
        }),
      );
    });

    const initConfig = posthogMock.init.mock.calls[0]?.[1];
    initConfig.loaded({
      capture: posthogMock.capture,
    });

    await waitFor(() => {
      expect(posthogMock.capture).toHaveBeenCalledWith("$pageview");
    });
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
