"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

function initOnce() {
  if (initialized || typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: {
      dom_event_allowlist: ["click", "submit"],
    },
    mask_personal_data_properties: true,
    respect_dnt: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-private], input, textarea",
    },
    loaded: (client) => {
      client.capture("$pageview");
    },
  });
  initialized = true;
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initOnce();
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;
  return <Provider client={posthog}>{children}</Provider>;
}
