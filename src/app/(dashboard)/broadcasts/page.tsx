import { BroadcastsList } from "@/components/broadcasts-list";
import { getServerSession } from "@/lib/api-auth";
import { createBroadcastService } from "@opensend/core";
import { redirect } from "next/navigation";

type BroadcastsPageSearchParams = Record<string, string | string[] | undefined>;

interface BroadcastsPageProps {
  searchParams?: Promise<BroadcastsPageSearchParams>;
}

const broadcastService = createBroadcastService();

function getSearchParam(
  searchParams: BroadcastsPageSearchParams,
  key: string,
): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseLimit(value: string): number {
  const limit = Number(value) || 40;
  return limit === 80 || limit === 120 ? limit : 40;
}

export default async function BroadcastsPage({
  searchParams,
}: BroadcastsPageProps = {}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const search = getSearchParam(resolvedSearchParams, "search").trim();
  const status = getSearchParam(resolvedSearchParams, "status").trim();
  const segmentId = getSearchParam(resolvedSearchParams, "segmentId").trim();
  const page = Math.max(
    1,
    Number(getSearchParam(resolvedSearchParams, "page")) || 1,
  );
  const limit = parseLimit(getSearchParam(resolvedSearchParams, "limit"));

  let initialBroadcasts: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  }[] = [];
  let initialTotal = 0;
  let initialError: string | null = null;

  try {
    const result = await broadcastService.listBroadcasts({
      userId: session.user.id,
      limit,
      search: search || undefined,
      status: status || undefined,
      segmentId: segmentId || undefined,
    });

    initialBroadcasts = result.data.map((broadcast) => ({
      id: broadcast.id,
      name: broadcast.name,
      status: broadcast.status,
      createdAt: broadcast.createdAt.toISOString(),
    }));
    initialTotal = result.hasMore
      ? initialBroadcasts.length + 1
      : initialBroadcasts.length;
  } catch (error) {
    console.error("Failed to load broadcasts dashboard:", error);
    initialError = "Failed to load broadcasts.";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg mb-6">Broadcasts</h1>
      <BroadcastsList
        initialAudienceFilter={segmentId}
        initialBroadcasts={initialBroadcasts}
        initialError={initialError}
        initialLimit={limit}
        initialPage={page}
        initialSearch={search}
        initialStatusFilter={status}
        initialTotal={initialTotal}
      />
    </div>
  );
}
