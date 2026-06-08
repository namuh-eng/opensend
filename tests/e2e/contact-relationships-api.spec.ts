import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

test.describe("root contact relationship API", () => {
  test("manages segment and topic relationships with API-key tenant isolation", async ({
    e2eApiRequest,
    e2eDb,
    e2eRunId,
    playwright,
  }) => {
    const otherTenant = await createE2ETenant(e2eDb, e2eRunId, "secondary");
    const otherRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: { Authorization: otherTenant.apiKey.authorization },
    });

    try {
      const contactEmail = `contact-rel-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
      const createContactResponse = await e2eApiRequest.post("/contacts", {
        data: {
          email: contactEmail,
          first_name: "Contact",
          last_name: "Owner",
        },
      });
      expect(createContactResponse.status()).toBe(201);
      const createdContact = (await createContactResponse.json()) as {
        id: string;
      };
      const contactId = createdContact.id;

      const otherContactEmail = `other-contact-rel-${e2eRunId}@${e2eRunId}.e2e.opensend.test`;
      const createOtherContactResponse = await otherRequest.post("/contacts", {
        data: {
          email: otherContactEmail,
          first_name: "Other",
          last_name: "Tenant",
        },
      });
      expect(createOtherContactResponse.status()).toBe(201);
      await createOtherContactResponse.json();

      const createSegmentResponse = await e2eApiRequest.post("/segments", {
        data: { name: `Relationship Segment ${e2eRunId}` },
      });
      expect(createSegmentResponse.status()).toBe(201);
      const createdSegment = (await createSegmentResponse.json()) as {
        id: string;
      };
      const segmentId = createdSegment.id;

      const createTopicResponse = await e2eApiRequest.post("/topics", {
        data: { name: `Relationship Topic ${e2eRunId}` },
      });
      expect(createTopicResponse.status()).toBe(201);
      const createdTopic = (await createTopicResponse.json()) as { id: string };
      const topicId = createdTopic.id;

      const createOtherTopicResponse = await otherRequest.post("/topics", {
        data: { name: `Other Relationship Topic ${e2eRunId}` },
      });
      expect(createOtherTopicResponse.status()).toBe(201);
      const createdOtherTopic = (await createOtherTopicResponse.json()) as {
        id: string;
      };
      const otherTopicId = createdOtherTopic.id;

      const addSegmentResponse = await e2eApiRequest.post(
        `/contacts/${encodeURIComponent(contactEmail)}/segments/${segmentId}`,
      );
      expect(addSegmentResponse.status()).toBe(200);
      await expect(addSegmentResponse.json()).resolves.toEqual({
        object: "contact_segment",
        contact_id: contactId,
        segment_id: segmentId,
        added: true,
      });

      const storedSegmentRows = await e2eDb.query<{
        count: string;
        segments: string[];
      }>(
        `select count(*)::text, contacts.segments
         from contacts_to_segments
         join contacts on contacts.id = contacts_to_segments.contact_id
         where contact_id = $1 and segment_id = $2
         group by contacts.segments`,
        [contactId, segmentId],
      );
      expect(storedSegmentRows.rows).toEqual([
        { count: "1", segments: [`Relationship Segment ${e2eRunId}`] },
      ]);

      const listSegmentsResponse = await e2eApiRequest.get(
        `/contacts/${contactEmail}/segments`,
      );
      expect(listSegmentsResponse.status()).toBe(200);
      await expect(listSegmentsResponse.json()).resolves.toEqual({
        object: "list",
        data: [
          {
            id: segmentId,
            name: `Relationship Segment ${e2eRunId}`,
            created_at: expect.any(String),
          },
        ],
        has_more: false,
      });

      const updateTopicsResponse = await e2eApiRequest.patch(
        `/contacts/${encodeURIComponent(contactEmail)}/topics`,
        {
          data: {
            topics: [{ id: topicId, subscription: "opt_in" }],
          },
        },
      );
      expect(updateTopicsResponse.status()).toBe(200);
      await expect(updateTopicsResponse.json()).resolves.toEqual({
        object: "contact_topics",
        contact_id: contactId,
        updated: true,
      });

      const listTopicsResponse = await e2eApiRequest.get(
        `/contacts/${contactEmail}/topics`,
      );
      expect(listTopicsResponse.status()).toBe(200);
      await expect(listTopicsResponse.json()).resolves.toEqual({
        object: "list",
        data: [
          {
            id: topicId,
            name: `Relationship Topic ${e2eRunId}`,
            subscription: "opt_in",
          },
        ],
      });

      const otherListSegmentsResponse = await otherRequest.get(
        `/contacts/${contactId}/segments`,
      );
      expect(otherListSegmentsResponse.status()).toBe(404);
      await expect(otherListSegmentsResponse.json()).resolves.toEqual({
        error: "Contact not found",
      });

      const otherAddSegmentResponse = await otherRequest.post(
        `/contacts/${encodeURIComponent(otherContactEmail)}/segments/${segmentId}`,
      );
      expect(otherAddSegmentResponse.status()).toBe(404);
      await expect(otherAddSegmentResponse.json()).resolves.toEqual({
        error: "Segment not found",
      });

      const crossTenantTopicResponse = await e2eApiRequest.patch(
        `/contacts/${encodeURIComponent(contactEmail)}/topics`,
        {
          data: {
            topics: [{ id: otherTopicId, subscription: "opt_in" }],
          },
        },
      );
      expect(crossTenantTopicResponse.status()).toBe(404);
      await expect(crossTenantTopicResponse.json()).resolves.toEqual({
        error: "Topic not found",
      });

      const removeSegmentResponse = await e2eApiRequest.delete(
        `/contacts/${encodeURIComponent(contactEmail)}/segments/${segmentId}`,
      );
      expect(removeSegmentResponse.status()).toBe(200);
      await expect(removeSegmentResponse.json()).resolves.toEqual({
        object: "contact_segment",
        contact_id: contactId,
        segment_id: segmentId,
        deleted: true,
      });

      const deletedRelationshipRows = await e2eDb.query<{ count: string }>(
        `select count(*)::text from contacts_to_segments
         where contact_id = $1 and segment_id = $2`,
        [contactId, segmentId],
      );
      expect(deletedRelationshipRows.rows).toEqual([{ count: "0" }]);
    } finally {
      await e2eDb.query("delete from topics where user_id like $1", [
        `e2e-user-${e2eRunId}%`,
      ]);
      await otherRequest.dispose();
    }
  });
});
