"use client";

import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { dedicatedIpPoolRepo } from "@opensend/core";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadPageData(userId: string) {
  const [pools, sub] = await Promise.all([
    dedicatedIpPoolRepo.listForUser(userId),
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    }),
  ]);

  let dedicatedIpsEnabled = false;
  let maxDedicatedIps = 0;

  if (sub) {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, sub.planId),
    });
    if (plan) {
      dedicatedIpsEnabled = plan.dedicatedIpsEnabled;
      maxDedicatedIps = plan.maxDedicatedIps;
    }
  }

  return { pools, dedicatedIpsEnabled, maxDedicatedIps };
}

export default async function DedicatedIpsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const { pools, dedicatedIpsEnabled, maxDedicatedIps } = await loadPageData(
    session.user.id,
  );

  if (!dedicatedIpsEnabled) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-fg">Dedicated IP Pools</h1>
          <p className="text-[14px] text-fg-2">
            Dedicated IP pools are not available on your current plan.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2 p-4">
          <p className="text-[13px] text-fg-2">
            Upgrade your plan to access dedicated IP pools for improved
            deliverability and TLS enforcement per domain.
          </p>
        </div>
        <Link
          href="/settings/billing"
          className="inline-flex rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-bg-card"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-fg">Dedicated IP Pools</h1>
          <p className="text-[14px] text-fg-2">
            Manage dedicated IP pools for your sending domains. You are using{" "}
            {pools.length} of {maxDedicatedIps} pool
            {maxDedicatedIps !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      {pools.length === 0 ? (
        <div className="rounded-lg border border-line bg-bg-2 p-6 text-center">
          <p className="text-[14px] text-fg-2">
            No dedicated IP pools yet. Create one via the API and assign it to a
            domain.
          </p>
          <p className="mt-2 text-[13px] text-fg-3">
            Use{" "}
            <code className="rounded bg-bg-3 px-1 py-0.5 text-[12px]">
              POST /api/dedicated-ips
            </code>{" "}
            to create a pool.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="flex items-center justify-between rounded-lg border border-line bg-bg-2 px-4 py-3"
            >
              <div className="space-y-0.5">
                <p className="text-[14px] font-medium text-fg">{pool.name}</p>
                <p className="text-[12px] text-fg-2">
                  SES pool:{" "}
                  <span className="font-mono">{pool.sesPoolName}</span>
                  {" · "}
                  {pool.scalingMode}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  pool.status === "active"
                    ? "bg-green-900/40 text-green-400"
                    : pool.status === "failed"
                      ? "bg-red-900/40 text-red-400"
                      : "bg-yellow-900/40 text-yellow-400"
                }`}
              >
                {pool.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-line bg-bg-2 p-4">
        <p className="text-[13px] font-medium text-fg">
          Assign a pool to a domain
        </p>
        <p className="mt-1 text-[13px] text-fg-2">
          Use{" "}
          <code className="rounded bg-bg-3 px-1 py-0.5 text-[12px]">
            PATCH /api/domains/:id
          </code>{" "}
          with{" "}
          <code className="rounded bg-bg-3 px-1 py-0.5 text-[12px]">
            dedicated_ip_pool_id
          </code>{" "}
          to route sending traffic for that domain through a specific pool.
        </p>
      </div>
    </div>
  );
}
