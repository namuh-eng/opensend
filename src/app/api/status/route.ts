// ABOUTME: Public status endpoint — exposes coarse component health without dashboard auth.

import { getPublicStatusSnapshot } from "@/lib/public-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getPublicStatusSnapshot();

  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
