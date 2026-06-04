"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const INITIAL_PAGEVIEW_DISTINCT_ID_KEY = "opensend_posthog_distinct_id";

let initialized = false;

function getDistinctId() {
  try {
    const existing = window.localStorage.getItem(
      INITIAL_PAGEVIEW_DISTINCT_ID_KEY,
    );
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(INITIAL_PAGEVIEW_DISTINCT_ID_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function captureInitialPageview() {
  if (!POSTHOG_KEY) return;

  const currentUrl = window.location.href;
  const payload = {
    api_key: POSTHOG_KEY,
    event: "$pageview",
    distinct_id: getDistinctId(),
    properties: {
      token: POSTHOG_KEY,
      $current_url: currentUrl,
      $host: window.location.host,
      $pathname: window.location.pathname,
      $referrer: document.referrer,
      $lib: "opensend-web",
    },
  };

  void fetch(`${POSTHOG_HOST.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    posthog.capture("$pageview");
  });
}

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
  });
  initialized = true;
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initOnce();
    if (!POSTHOG_KEY) return;
    const pageviewTimer = window.setTimeout(() => {
      captureInitialPageview();
    }, 1000);
    return () => window.clearTimeout(pageviewTimer);
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;
  return <Provider client={posthog}>{children}</Provider>;
}
