import { describe, expect, it } from "vitest";
import { isAllowedSnsSubscribeUrl } from "../packages/ingester/src/sns-subscribe-url";

describe("isAllowedSnsSubscribeUrl", () => {
  it("accepts canonical SNS US regions", () => {
    expect(
      isAllowedSnsSubscribeUrl(
        "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&...",
      ),
    ).toBe(true);
    expect(
      isAllowedSnsSubscribeUrl(
        "https://sns.eu-west-2.amazonaws.com/?Action=ConfirmSubscription",
      ),
    ).toBe(true);
  });

  it("accepts SNS China regions (.cn TLD)", () => {
    expect(
      isAllowedSnsSubscribeUrl(
        "https://sns.cn-north-1.amazonaws.com.cn/?Action=ConfirmSubscription",
      ),
    ).toBe(true);
  });

  it("rejects non-https schemes", () => {
    expect(
      isAllowedSnsSubscribeUrl("http://sns.us-east-1.amazonaws.com/"),
    ).toBe(false);
    expect(isAllowedSnsSubscribeUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects unrelated hosts", () => {
    expect(isAllowedSnsSubscribeUrl("https://evil.com/")).toBe(false);
    expect(
      isAllowedSnsSubscribeUrl("https://sns.us-east-1.amazonaws.com.evil.com/"),
    ).toBe(false);
    expect(
      isAllowedSnsSubscribeUrl("https://evil.com/?host=sns.amazonaws.com"),
    ).toBe(false);
  });

  it("rejects host attempting to use SNS as path", () => {
    expect(
      isAllowedSnsSubscribeUrl("https://evil.com/sns.us-east-1.amazonaws.com"),
    ).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isAllowedSnsSubscribeUrl("not-a-url")).toBe(false);
    expect(isAllowedSnsSubscribeUrl("")).toBe(false);
  });
});
