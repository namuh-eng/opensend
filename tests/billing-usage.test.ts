import {
  USAGE_CRITICAL_RATIO,
  USAGE_WARN_RATIO,
  formatUsagePercent,
  getProgressBarPercent,
  getUsageRatio,
  getUsageThreshold,
  isOverLimit,
} from "@/lib/billing/usage";
import { describe, expect, it } from "vitest";

describe("getUsageRatio", () => {
  it("returns 0 for an unused metric", () => {
    expect(getUsageRatio({ used: 0, limit: 1000 })).toBe(0);
  });

  it("returns the proportional ratio", () => {
    expect(getUsageRatio({ used: 250, limit: 1000 })).toBe(0.25);
    expect(getUsageRatio({ used: 800, limit: 1000 })).toBe(0.8);
  });

  it("treats limit=0 as already-saturated when usage is non-zero", () => {
    expect(getUsageRatio({ used: 0, limit: 0 })).toBe(0);
    expect(getUsageRatio({ used: 1, limit: 0 })).toBe(1);
  });

  it("never returns a negative ratio for negative usage", () => {
    expect(getUsageRatio({ used: -10, limit: 100 })).toBe(0);
  });

  it("handles ratios above 1 (over-quota) without clamping the raw value", () => {
    expect(getUsageRatio({ used: 1500, limit: 1000 })).toBe(1.5);
  });
});

describe("getUsageThreshold", () => {
  it("returns 'ok' below the warn threshold", () => {
    expect(getUsageThreshold({ used: 500, limit: 1000 })).toBe("ok");
    expect(
      getUsageThreshold({ used: USAGE_WARN_RATIO * 1000 - 1, limit: 1000 }),
    ).toBe("ok");
  });

  it("returns 'warn' once usage hits 80%", () => {
    expect(getUsageThreshold({ used: 800, limit: 1000 })).toBe("warn");
    expect(getUsageThreshold({ used: 999, limit: 1000 })).toBe("warn");
  });

  it("returns 'critical' at and above 100%", () => {
    expect(getUsageThreshold({ used: 1000, limit: 1000 })).toBe("critical");
    expect(getUsageThreshold({ used: 1500, limit: 1000 })).toBe("critical");
    expect(USAGE_CRITICAL_RATIO).toBe(1);
  });
});

describe("formatUsagePercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(formatUsagePercent({ used: 0, limit: 1000 })).toBe("0%");
    expect(formatUsagePercent({ used: 500, limit: 1000 })).toBe("50%");
    expect(formatUsagePercent({ used: 999, limit: 1000 })).toBe("100%");
  });

  it("clamps over-quota usage to 100% for display", () => {
    expect(formatUsagePercent({ used: 1500, limit: 1000 })).toBe("100%");
  });
});

describe("getProgressBarPercent", () => {
  it("clamps to [0, 100] for the progress bar width", () => {
    expect(getProgressBarPercent({ used: 0, limit: 1000 })).toBe(0);
    expect(getProgressBarPercent({ used: 500, limit: 1000 })).toBe(50);
    expect(getProgressBarPercent({ used: 1500, limit: 1000 })).toBe(100);
    expect(getProgressBarPercent({ used: -10, limit: 1000 })).toBe(0);
  });
});

describe("isOverLimit", () => {
  it("flags when usage meets or exceeds limit", () => {
    expect(isOverLimit({ used: 999, limit: 1000 })).toBe(false);
    expect(isOverLimit({ used: 1000, limit: 1000 })).toBe(true);
    expect(isOverLimit({ used: 2000, limit: 1000 })).toBe(true);
  });

  it("treats limit=0 as never reached", () => {
    expect(isOverLimit({ used: 100, limit: 0 })).toBe(false);
  });
});
