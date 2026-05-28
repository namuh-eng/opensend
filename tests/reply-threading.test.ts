import { describe, expect, it } from "vitest";
import {
  buildReplyAddress,
  extractReplyTokensFromAddresses,
  extractReplyTokensFromHeaders,
  generateReplyToken,
  parseReplyToken,
  validateReplyToken,
} from "../packages/core/src/services/replyThreading";

const userId = "user_reply_1";
const emailId = "11111111-2222-4333-8444-555555555555";
const replyDomain = "inbound.example.test";
const secret = "unit-test-secret";

describe("reply threading token generation", () => {
  it("generates stable address-safe tokens for a tenant email and domain", () => {
    const first = generateReplyToken({ userId, emailId, replyDomain, secret });
    const second = generateReplyToken({ userId, emailId, replyDomain, secret });

    expect(first).toBe(second);
    expect(first).toMatch(/^osr_[0-9a-f]{32}_[0-9a-f]{24}$/);
    expect(buildReplyAddress({ token: first, replyDomain })).toBe(
      `reply+${first}@${replyDomain}`,
    );
    expect(parseReplyToken(first)).toEqual({
      emailId,
      signature: first.split("_")[2],
    });
  });

  it("validates only the original tenant/domain token tuple", () => {
    const token = generateReplyToken({ userId, emailId, replyDomain, secret });

    expect(validateReplyToken({ token, userId, replyDomain, secret })).toEqual({
      valid: true,
      emailId,
    });
    expect(
      validateReplyToken({
        token,
        userId: "other-user",
        replyDomain,
        secret,
      }),
    ).toEqual({ valid: false });
    expect(
      validateReplyToken({
        token,
        userId,
        replyDomain: "other.example.test",
        secret,
      }),
    ).toEqual({ valid: false });
    expect(
      validateReplyToken({
        token: token.replace(/.$/, "0"),
        userId,
        replyDomain,
        secret,
      }),
    ).toEqual({ valid: false });
  });

  it("extracts reply tokens from generated addresses and safe headers", () => {
    const token = generateReplyToken({ userId, emailId, replyDomain, secret });

    expect(
      extractReplyTokensFromAddresses([
        `Reply+${token.toUpperCase()}@${replyDomain}`,
        "support@example.test",
      ]),
    ).toEqual([token]);
    expect(
      extractReplyTokensFromHeaders({
        "X-OpenSend-Reply-Token": token,
        References: `<provider@example.test> <${token}@${replyDomain}>`,
      }),
    ).toEqual([token]);
  });
});
