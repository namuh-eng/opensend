import { getServerSession } from "@/lib/api-auth";

import { dedicatedIpPoolRepo, resolveBillingEntitlement } from "@opensend/core";

import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadPageData(userId: string) {
  const [pools, entitlement] = await Promise.all([
    dedicatedIpPoolRepo.listForUser(userId),
    resolveBillingEntitlement(userId),
  ]);

  let dedicatedIpsEnabled = false;
  let maxDedicatedIps = 0;

  if (entitlement.mode === "self_host") {
    dedicatedIpsEnabled = true;
    maxDedicatedIps = Number.MAX_SAFE_INTEGER;
  } else if (entitlement.mode === "active") {
    dedicatedIpsEnabled = entitlement.plan.dedicatedIpsEnabled;
    maxDedicatedIps = entitlement.plan.maxDedicatedIps;
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
          <h1 className="text-2xl font-semibold text-fg">
            Dedicated IP Lifecycle
          </h1>
          <p className="text-[14px] text-fg-2">
            Dedicated IP lifecycle tracking is not available on your current
            plan.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2 p-4">
          <p className="text-[13px] text-fg-2">
            Upgrade your plan to request dedicated IP support and track manual
            lifecycle states. OpenSend v1 does not provision or warm provider
            IPs automatically.
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
          <h1 className="text-2xl font-semibold text-fg">
            Dedicated IP Lifecycle
          </h1>
          <p className="text-[14px] text-fg-2">
            Track manual dedicated IP requests for your sending domains. You are
            using {pools.length} of {maxDedicatedIps} lifecycle record
            {maxDedicatedIps !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      {pools.length === 0 ? (
        <div className="rounded-lg border border-line bg-bg-2 p-6 text-center">
          <p className="text-[14px] text-fg-2">
            No dedicated IP lifecycle records yet. Create a request via the API;
            an operator can mark it provisioned, warming, active, suspended, or
            retired.
          </p>
          <p className="mt-2 text-[13px] text-fg-3">
            Use{" "}
            <code className="rounded bg-bg-3 px-1 py-0.5 text-[12px]">
              POST /api/dedicated-ips
            </code>{" "}
            to create a manual lifecycle request.
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
                  Provider reference:{" "}
                  <span className="font-mono">{pool.sesPoolName}</span>
                  {" · "}
                  {pool.scalingMode}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  pool.status === "active"
                    ? "bg-green-900/40 text-green-400"
                    : pool.status === "suspended" || pool.status === "retired"
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
        <p className="text-[13px] font-medium text-fg">Manual lifecycle only</p>
        <p className="mt-1 text-[13px] text-fg-2">
          Use{" "}
          <code className="rounded bg-bg-3 px-1 py-0.5 text-[12px]">
            PATCH /api/dedicated-ips/:id
          </code>{" "}
          responses to inspect lifecycle state. Provider provisioning, IP
          warmup, and provider assignment are operator-managed in this v1
          readiness/status slice.
        </p>
      </div>
    </div>
  );
}
