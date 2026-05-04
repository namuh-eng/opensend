import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { contacts, domains, emails, segments } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { NextResponse } from "next/server";

// Dashboard-only internal endpoint
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [
      monthlyEmails,
      dailyEmails,
      contactCount,
      segmentCount,
      domainCount,
    ] = await Promise.all([
      db.$count(emails, gte(emails.createdAt, startOfMonth)),
      db.$count(emails, gte(emails.createdAt, startOfDay)),
      db.$count(contacts),
      db.$count(segments),
      db.$count(domains),
    ]);

    return NextResponse.json({
      transactional: {
        monthlyUsed: Number(monthlyEmails),
        monthlyLimit: 3000,
        dailyUsed: Number(dailyEmails),
        dailyLimit: 100,
      },
      marketing: {
        contactsUsed: Number(contactCount),
        contactsLimit: 1000,
        segmentsUsed: Number(segmentCount),
        segmentsLimit: 3,
        broadcastsLimit: "Unlimited",
      },
      team: {
        domainsUsed: Number(domainCount),
        domainsLimit: 3,
        rateLimit: 2,
      },
    });
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
