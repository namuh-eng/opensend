import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock environment variables
vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-cf-token-123");
vi.stubEnv("CLOUDFLARE_ZONE_ID", "test-zone-id-456");

import {
  type DNSRecord,
  autoConfigureDomain,
  createDNSRecord,
  deleteDNSRecord,
  listDNSRecords,
} from "@/lib/cloudflare";

describe("Cloudflare DNS Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("createDNSRecord", () => {
    it("creates a TXT record for DKIM", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "dns-record-001",
            type: "TXT",
            name: "token1._domainkey.example.com",
            content: "token1.dkim.amazonses.com",
            ttl: 300,
          },
        }),
      });

      const record: DNSRecord = {
        type: "TXT",
        name: "token1._domainkey.example.com",
        content: "token1.dkim.amazonses.com",
        ttl: 300,
      };

      const result = await createDNSRecord(record);

      expect(result).toEqual({
        id: "dns-record-001",
        type: "TXT",
        name: "token1._domainkey.example.com",
        content: "token1.dkim.amazonses.com",
        ttl: 300,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/test-zone-id-456/dns_records",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-cf-token-123",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "TXT",
            name: "token1._domainkey.example.com",
            content: "token1.dkim.amazonses.com",
            ttl: 300,
          }),
        }),
      );
    });

    it("creates a CNAME record for DKIM", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "dns-record-002",
            type: "CNAME",
            name: "token1._domainkey.example.com",
            content: "token1.dkim.amazonses.com",
            ttl: 300,
          },
        }),
      });

      const record: DNSRecord = {
        type: "CNAME",
        name: "token1._domainkey.example.com",
        content: "token1.dkim.amazonses.com",
        ttl: 300,
      };

      const result = await createDNSRecord(record);

      expect(result.id).toBe("dns-record-002");
      expect(result.type).toBe("CNAME");
    });

    it("creates an MX record with priority", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "dns-record-003",
            type: "MX",
            name: "example.com",
            content: "feedback-smtp.us-east-1.amazonses.com",
            ttl: 300,
            priority: 10,
          },
        }),
      });

      const record: DNSRecord = {
        type: "MX",
        name: "example.com",
        content: "feedback-smtp.us-east-1.amazonses.com",
        ttl: 300,
        priority: 10,
      };

      const result = await createDNSRecord(record);

      expect(result).toEqual({
        id: "dns-record-003",
        type: "MX",
        name: "example.com",
        content: "feedback-smtp.us-east-1.amazonses.com",
        ttl: 300,
        priority: 10,
      });

      // Verify priority is included in the request body
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.priority).toBe(10);
    });

    it("throws on Cloudflare API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          errors: [{ code: 1004, message: "DNS Validation Error" }],
        }),
      });

      const record: DNSRecord = {
        type: "TXT",
        name: "bad.example.com",
        content: "value",
        ttl: 300,
      };

      await expect(createDNSRecord(record)).rejects.toThrow(
        "Cloudflare API error: DNS Validation Error",
      );
    });

    it("throws when API token is missing", async () => {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "");

      await expect(
        createDNSRecord({
          type: "TXT",
          name: "test.com",
          content: "value",
          ttl: 300,
        }),
      ).rejects.toThrow("CLOUDFLARE_API_TOKEN is required");

      vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-cf-token-123");
    });

    it("throws when zone ID is missing", async () => {
      vi.stubEnv("CLOUDFLARE_ZONE_ID", "");

      await expect(
        createDNSRecord({
          type: "TXT",
          name: "test.com",
          content: "value",
          ttl: 300,
        }),
      ).rejects.toThrow("CLOUDFLARE_ZONE_ID is required");

      vi.stubEnv("CLOUDFLARE_ZONE_ID", "test-zone-id-456");
    });
  });

  describe("listDNSRecords", () => {
    it("lists DNS records filtered by name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [
            {
              id: "dns-001",
              type: "TXT",
              name: "example.com",
              content: "v=spf1 include:amazonses.com ~all",
              ttl: 300,
            },
            {
              id: "dns-002",
              type: "MX",
              name: "example.com",
              content: "feedback-smtp.us-east-1.amazonses.com",
              ttl: 300,
              priority: 10,
            },
          ],
        }),
      });

      const records = await listDNSRecords({ name: "example.com" });

      expect(records).toHaveLength(2);
      expect(records[0].type).toBe("TXT");
      expect(records[1].type).toBe("MX");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("name=example.com");
    });

    it("lists DNS records filtered by type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [
            {
              id: "dns-003",
              type: "CNAME",
              name: "token1._domainkey.example.com",
              content: "token1.dkim.amazonses.com",
              ttl: 300,
            },
          ],
        }),
      });

      const records = await listDNSRecords({ type: "CNAME" });

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe("CNAME");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("type=CNAME");
    });

    it("lists all records when no filters provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [],
        }),
      });

      const records = await listDNSRecords();

      expect(records).toEqual([]);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("name=");
      expect(url).not.toContain("type=");
    });
  });

  describe("deleteDNSRecord", () => {
    it("deletes a DNS record by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: "dns-record-001" },
        }),
      });

      await expect(deleteDNSRecord("dns-record-001")).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/test-zone-id-456/dns_records/dns-record-001",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Authorization: "Bearer test-cf-token-123",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("throws when record ID is empty", async () => {
      await expect(deleteDNSRecord("")).rejects.toThrow(
        "record ID is required",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws on Cloudflare API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          errors: [{ code: 1032, message: "Record not found" }],
        }),
      });

      await expect(deleteDNSRecord("nonexistent")).rejects.toThrow(
        "Cloudflare API error: Record not found",
      );
    });
  });

  describe("autoConfigureDomain", () => {
    it("creates DKIM, SPF, and MX records for a domain with no existing records", async () => {
      // listDNSRecords for MX → empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [] }),
      });
      // listDNSRecords for TXT → empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [] }),
      });
      // Three DKIM records, one SPF record, one MX record
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: `dns-record-${i}`,
              type: i < 3 ? "CNAME" : i === 3 ? "TXT" : "MX",
              name:
                i < 3
                  ? `token${i + 1}._domainkey.example.com`
                  : "send.example.com",
              content:
                i < 3
                  ? `token${i + 1}.dkim.amazonses.com`
                  : i === 3
                    ? "v=spf1 include:amazonses.com ~all"
                    : "feedback-smtp.us-east-1.amazonses.com",
              ttl: 300,
              ...(i === 4 ? { priority: 10 } : {}),
            },
          }),
        });
      }

      const dkimTokens = ["token1", "token2", "token3"];
      const { records, warnings } = await autoConfigureDomain(
        "example.com",
        dkimTokens,
      );

      expect(records).toHaveLength(5);
      expect(warnings).toHaveLength(0);
      // 2 GETs (list) + 3 DKIM + 1 SPF + 1 MX
      expect(mockFetch).toHaveBeenCalledTimes(7);
      expect(mockFetch.mock.calls[0][0]).toContain("name=send.example.com");
      expect(mockFetch.mock.calls[0][0]).toContain("type=MX");
      expect(mockFetch.mock.calls[1][0]).toContain("name=send.example.com");
      expect(mockFetch.mock.calls[1][0]).toContain("type=TXT");

      // Verify each DKIM CNAME record was created correctly
      for (let i = 0; i < 3; i++) {
        const call = mockFetch.mock.calls[i + 2];
        const body = JSON.parse(call[1].body);
        expect(body.type).toBe("CNAME");
        expect(body.name).toBe(`token${i + 1}._domainkey.example.com`);
        expect(body.content).toBe(`token${i + 1}.dkim.amazonses.com`);
      }

      const spfCall = mockFetch.mock.calls[5];
      const spfBody = JSON.parse(spfCall[1].body);
      expect(spfBody).toEqual({
        type: "TXT",
        name: "send.example.com",
        content: "v=spf1 include:amazonses.com ~all",
        ttl: 300,
      });

      const mxCall = mockFetch.mock.calls[6];
      const mxBody = JSON.parse(mxCall[1].body);
      expect(mxBody).toEqual({
        type: "MX",
        name: "send.example.com",
        content: "feedback-smtp.us-east-1.amazonses.com",
        ttl: 300,
        priority: 10,
      });
    });

    it("uses a custom return path label for SPF and MX records", async () => {
      // listDNSRecords for MX → empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [] }),
      });
      // listDNSRecords for TXT → empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [] }),
      });
      // One DKIM record, one SPF record, one MX record
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: `custom-dns-record-${i}`,
              type: i === 0 ? "CNAME" : i === 1 ? "TXT" : "MX",
              name:
                i === 0
                  ? "token1._domainkey.example.com"
                  : "outbound.example.com",
              content:
                i === 0
                  ? "token1.dkim.amazonses.com"
                  : i === 1
                    ? "v=spf1 include:amazonses.com ~all"
                    : "feedback-smtp.us-east-1.amazonses.com",
              ttl: 300,
              ...(i === 2 ? { priority: 10 } : {}),
            },
          }),
        });
      }

      await autoConfigureDomain("example.com", ["token1"], "outbound");

      expect(mockFetch.mock.calls[0][0]).toContain("name=outbound.example.com");
      expect(mockFetch.mock.calls[1][0]).toContain("name=outbound.example.com");

      const spfBody = JSON.parse(mockFetch.mock.calls[3][1].body);
      expect(spfBody.name).toBe("outbound.example.com");

      const mxBody = JSON.parse(mockFetch.mock.calls[4][1].body);
      expect(mxBody.name).toBe("outbound.example.com");
    });

    it("skips MX and merges SPF when existing records are present", async () => {
      // listDNSRecords for MX → existing iCloud MX
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [
            {
              id: "existing-mx",
              type: "MX",
              name: "send.example.com",
              content: "mx01.mail.icloud.com",
              ttl: 3600,
              priority: 10,
            },
          ],
        }),
      });
      // listDNSRecords for TXT → existing iCloud SPF
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [
            {
              id: "existing-spf",
              type: "TXT",
              name: "send.example.com",
              content: "v=spf1 include:icloud.com ~all",
              ttl: 3600,
            },
          ],
        }),
      });
      // 3 DKIM creates
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: `dkim-${i}`,
              type: "CNAME",
              name: `token${i + 1}._domainkey.example.com`,
              content: `token${i + 1}.dkim.amazonses.com`,
              ttl: 300,
            },
          }),
        });
      }
      // SPF update (PUT)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "existing-spf",
            type: "TXT",
            name: "send.example.com",
            content: "v=spf1 include:icloud.com include:amazonses.com ~all",
            ttl: 3600,
          },
        }),
      });

      const { records, warnings } = await autoConfigureDomain("example.com", [
        "token1",
        "token2",
        "token3",
      ]);

      // 3 DKIM + 1 SPF update (no MX)
      expect(records).toHaveLength(4);
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toMatch(/Merged amazonses.com into existing SPF/);
      expect(warnings[1]).toMatch(/Existing MX records found/);
    });

    it("throws when domain is empty", async () => {
      await expect(autoConfigureDomain("", ["t1"])).rejects.toThrow(
        "domain is required",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws when dkimTokens is empty", async () => {
      await expect(autoConfigureDomain("example.com", [])).rejects.toThrow(
        "DKIM tokens are required",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
