import { getTodayApiBaseUrl } from "@/lib/today-dashboard";
import { afterEach, describe, expect, it } from "vitest";

function makeHeaders(values: Record<string, string>): Headers {
  return new Headers(values);
}

const envKeys = ["NEXT_PUBLIC_APP_URL", "APP_URL", "BETTER_AUTH_URL"] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof envKeys)[number], string | undefined>;

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("today dashboard helpers", () => {
  afterEach(() => {
    for (const key of envKeys) {
      setEnv(key, originalEnv[key]);
    }
  });

  it("uses the configured public app URL for quick-start API examples", () => {
    setEnv("NEXT_PUBLIC_APP_URL", "https://mail.example.com/");

    expect(getTodayApiBaseUrl()).toBe("https://mail.example.com");
  });

  it("falls back to the current forwarded request host", () => {
    setEnv("NEXT_PUBLIC_APP_URL", "");
    setEnv("APP_URL", "");
    setEnv("BETTER_AUTH_URL", "");

    expect(
      getTodayApiBaseUrl(
        makeHeaders({
          "x-forwarded-host": "selfhost.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://selfhost.example.com");
  });

  it("uses localhost when no configured or request host is available", () => {
    setEnv("NEXT_PUBLIC_APP_URL", "");
    setEnv("APP_URL", "");
    setEnv("BETTER_AUTH_URL", "");

    expect(getTodayApiBaseUrl()).toBe("http://localhost:3015");
  });
});
