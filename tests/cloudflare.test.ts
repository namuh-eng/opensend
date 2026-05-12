import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock environment variables
vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-cf-token-123");
vi.stubEnv("CLOUDFLARE_ZONE_ID", "test-zone-id-456");

import {
  type DNSRecord,
  configureDNSRecords,
  createDNSRecord,
  deleteDNSRecord,
  listDNSRecords,
  mapDomainRecordToDNSRecord,
  upsertDNSRecord,
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

  describe("domain DNS record mapping", () => {
    it("maps tracking CNAME guidance to Cloudflare's DNS record shape", () => {
      expect(
        mapDomainRecordToDNSRecord({
          type: "CNAME",
          name: "links.example.com",
          value: "track.opensend.example",
          ttl: "Auto",
        }),
      ).toEqual({
        type: "CNAME",
        name: "links.example.com",
        content: "track.opensend.example",
        ttl: 1,
      });
    });

    it("maps MX priority and ignores unsupported record types", () => {
      expect(
        mapDomainRecordToDNSRecord({
          type: "MX",
          name: "send.example.com",
          value: "feedback-smtp.us-east-1.amazonses.com",
          ttl: "300",
          priority: 10,
        }),
      ).toEqual({
        type: "MX",
        name: "send.example.com",
        content: "feedback-smtp.us-east-1.amazonses.com",
        ttl: 300,
        priority: 10,
      });
      expect(
        mapDomainRecordToDNSRecord({
          type: "CAA",
          name: "example.com",
          value: "0 issue amazon.com",
        }),
      ).toBeNull();
    });
  });

  describe("upsertDNSRecord", () => {
    it("updates an existing tracking CNAME when the target drifts", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: [
              {
                id: "dns-track",
                type: "CNAME",
                name: "links.example.com",
                content: "old.example",
                ttl: 1,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: "dns-track",
              type: "CNAME",
              name: "links.example.com",
              content: "track.opensend.example",
              ttl: 1,
            },
          }),
        });

      await expect(
        upsertDNSRecord({
          type: "CNAME",
          name: "links.example.com",
          content: "track.opensend.example",
          ttl: 1,
        }),
      ).resolves.toMatchObject({
        action: "updated",
        name: "links.example.com",
        type: "CNAME",
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://api.cloudflare.com/client/v4/zones/test-zone-id-456/dns_records/dns-track",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("creates the tracking CNAME during batch configure when missing", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: "dns-created",
              type: "CNAME",
              name: "links.example.com",
              content: "track.opensend.example",
              ttl: 1,
            },
          }),
        });

      await expect(
        configureDNSRecords([
          {
            type: "CNAME",
            name: "links.example.com",
            value: "track.opensend.example",
            ttl: "Auto",
          },
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          action: "created",
          name: "links.example.com",
          type: "CNAME",
        }),
      ]);
    });
  });
});
