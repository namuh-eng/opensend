import {
  ContactDetail,
  type ContactDetailData,
} from "@/components/contact-detail";
import { getServerSession } from "@/lib/api-auth";
import {
  ContactOperationsServiceError,
  ContactServiceError,
  createContactOperationsService,
  createContactService,
} from "@opensend/core";
import { notFound, redirect } from "next/navigation";

function toIsoString(value: Date | string | null): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

function toContactDetailData(
  contact: Awaited<
    ReturnType<ReturnType<typeof createContactService>["getContact"]>
  >,
  relationships: {
    segments: Awaited<
      ReturnType<ReturnType<typeof createContactService>["listContactSegments"]>
    >;
    topics: Awaited<
      ReturnType<
        ReturnType<typeof createContactOperationsService>["listContactTopics"]
      >
    >["data"];
  },
): ContactDetailData {
  const createdAt = toIsoString(contact.created_at);

  return {
    id: contact.id,
    email: contact.email,
    firstName: contact.first_name,
    lastName: contact.last_name,
    status: contact.unsubscribed ? "unsubscribed" : "subscribed",
    segments: relationships.segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
    })),
    topics: relationships.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      subscription: topic.subscription,
    })),
    properties: contact.properties ?? {},
    createdAt,
    activity: [
      {
        type: "Contact created",
        timestamp: createdAt,
      },
    ],
  };
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const { id } = await params;

  try {
    const contactService = createContactService();
    const contactOperationsService = createContactOperationsService();
    const [contact, segments, topicList] = await Promise.all([
      contactService.getContact(id, session.user.id),
      contactService.listContactSegments(id, session.user.id),
      contactOperationsService.listContactTopics({
        idOrEmail: id,
        userId: session.user.id,
      }),
    ]);
    return (
      <ContactDetail
        contact={toContactDetailData(contact, {
          segments,
          topics: topicList.data,
        })}
      />
    );
  } catch (error) {
    if (error instanceof ContactServiceError && error.code === "not_found") {
      notFound();
    }
    if (
      error instanceof ContactOperationsServiceError &&
      error.code === "not_found"
    ) {
      notFound();
    }
    throw error;
  }
}
