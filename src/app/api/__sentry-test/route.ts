import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("x-sentry-smoke") !== "1") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  throw new Error("sentry-smoke-test:opensend-web");
}
