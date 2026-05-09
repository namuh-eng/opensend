import {
  formatGithubStarCount,
  getOpenSendGithubStars,
} from "@/lib/github-stars";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatGithubStarCount", () => {
  it("keeps raw counts readable below one thousand", () => {
    expect(formatGithubStarCount(0)).toBe("0");
    expect(formatGithubStarCount(123)).toBe("123");
    expect(formatGithubStarCount(999)).toBe("999");
  });

  it("formats thousands and millions compactly", () => {
    expect(formatGithubStarCount(1_000)).toBe("1k");
    expect(formatGithubStarCount(1_249)).toBe("1.2k");
    expect(formatGithubStarCount(1_250)).toBe("1.3k");
    expect(formatGithubStarCount(12_345)).toBe("12.3k");
    expect(formatGithubStarCount(123_456)).toBe("123k");
    expect(formatGithubStarCount(1_234_567)).toBe("1.2M");
  });

  it("normalizes fractional and negative raw counts", () => {
    expect(formatGithubStarCount(42.9)).toBe("42");
    expect(formatGithubStarCount(-4)).toBe("0");
  });
});

describe("getOpenSendGithubStars", () => {
  it("returns a formatted star summary from the GitHub repository payload", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ stargazers_count: 1_234 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSendGithubStars()).resolves.toEqual({
      count: 1_234,
      formattedCount: "1.2k",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/namuh-eng/opensend",
      expect.objectContaining({
        next: { revalidate: 1_800 },
      }),
    );
  });

  it("falls back to null when GitHub cannot return a usable count", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ message: "rate limited" }, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSendGithubStars()).resolves.toBeNull();
  });

  it("falls back to null when the fetch fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error("network unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSendGithubStars()).resolves.toBeNull();
  });
});
