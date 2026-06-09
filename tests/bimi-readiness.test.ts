import { evaluateBimiReadiness } from "@opensend/core";
import { describe, expect, it } from "vitest";

const DOMAIN = "example.com";

function txt(name: string, values: string[]) {
  return { name, values };
}

describe("evaluateBimiReadiness", () => {
  it("marks BIMI ready when enforced DMARC, BIMI DNS, SVG logo, and certificate metadata exist", () => {
    const result = evaluateBimiReadiness({
      domainName: DOMAIN,
      dmarcTxt: txt(`_dmarc.${DOMAIN}`, ["v=DMARC1; p=reject; adkim=s"]),
      bimiTxt: txt(`default._bimi.${DOMAIN}`, [
        "v=BIMI1; l=https://assets.example.com/logo.svg; a=https://assets.example.com/vmc.pem",
      ]),
    });

    expect(result.status).toBe("ready");
    expect(result.logoUrl).toBe("https://assets.example.com/logo.svg");
    expect(result.certificateUrl).toBe("https://assets.example.com/vmc.pem");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("requires DMARC enforcement instead of p=none", () => {
    const result = evaluateBimiReadiness({
      domainName: DOMAIN,
      dmarcTxt: txt(`_dmarc.${DOMAIN}`, ["v=DMARC1; p=none"]),
      bimiTxt: txt(`default._bimi.${DOMAIN}`, [
        "v=BIMI1; l=https://assets.example.com/logo.svg",
      ]),
    });

    expect(result.status).toBe("action_required");
    expect(result.checks).toContainEqual(
      expect.objectContaining({ key: "dmarc_policy", status: "fail" }),
    );
  });

  it("reports not_configured when the BIMI TXT record is absent", () => {
    const result = evaluateBimiReadiness({
      domainName: DOMAIN,
      dmarcTxt: txt(`_dmarc.${DOMAIN}`, ["v=DMARC1; p=quarantine"]),
      bimiTxt: txt(`default._bimi.${DOMAIN}`, []),
    });

    expect(result.status).toBe("not_configured");
    expect(result.checks).toContainEqual(
      expect.objectContaining({ key: "bimi_dns", status: "fail" }),
    );
  });

  it("uses configured logo and certificate hints when DNS metadata is incomplete", () => {
    const result = evaluateBimiReadiness({
      domainName: DOMAIN,
      dmarcTxt: txt(`_dmarc.${DOMAIN}`, ["v=DMARC1; p=reject"]),
      bimiTxt: txt(`default._bimi.${DOMAIN}`, [
        "v=BIMI1; l=https://assets.example.com/logo.png",
      ]),
      configuredLogoUrl: "https://assets.example.com/logo.svg",
      configuredCertificateUrl: "https://assets.example.com/cmc.pem",
    });

    expect(result.status).toBe("ready");
    expect(result.logoUrl).toBe("https://assets.example.com/logo.svg");
    expect(result.certificateUrl).toBe("https://assets.example.com/cmc.pem");
  });
});
