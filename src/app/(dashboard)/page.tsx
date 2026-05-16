import {
  Card,
  PageHeader,
  Pill,
  SectionHeader,
  StatCard,
} from "@/components/ui-new";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SAMPLE_SENDS = [42, 58, 51, 73, 65, 88, 94, 82, 110, 124, 118, 142];
const SAMPLE_OPENS = [22, 26, 31, 35, 32, 41, 44, 38, 52, 58, 61, 72];
const SAMPLE_CLICKS = [4, 6, 5, 9, 7, 11, 13, 10, 14, 17, 16, 20];
const SAMPLE_BOUNCE = [1, 0, 2, 1, 1, 0, 0, 1, 1, 0, 2, 0];

type StatusKind = "verified" | "pending" | "warning";

async function loadStats(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${emails.status} = 'delivered')::int`,
        opened: sql<number>`count(*) filter (where ${emails.status} = 'opened')::int`,
        bounced: sql<number>`count(*) filter (where ${emails.status} = 'bounced')::int`,
      })
      .from(emails)
      .where(and(eq(emails.userId, userId), gte(emails.createdAt, since)));
    const r = rows[0] ?? { total: 0, delivered: 0, opened: 0, bounced: 0 };
    return r;
  } catch {
    return { total: 0, delivered: 0, opened: 0, bounced: 0 };
  }
}

function formatPct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}`;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 5) return `Working late, ${name}.`;
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 18) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

export default async function TodayPage() {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const userId = session.user.id;
  const stats = await loadStats(userId);
  const firstName =
    (session.user.name || session.user.email || "there").split(/[\s@]/)[0] ||
    "there";

  const kickerDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const domains: Array<{
    domain: string;
    status: StatusKind;
    delivered: number | null;
    opens: number | null;
  }> = [
    { domain: "acme.com", status: "verified", delivered: 99.2, opens: 41.8 },
    {
      domain: "mail.acme.com",
      status: "verified",
      delivered: 98.7,
      opens: 38.2,
    },
    {
      domain: "notify.acme.io",
      status: "pending",
      delivered: null,
      opens: null,
    },
  ];

  return (
    <div className="pb-16">
      <div className="px-8 pt-8">
        <PageHeader
          kicker={`// today · ${kickerDate}`}
          title={greeting(firstName)}
          sub="Steady sending. Delivery latency p50 within target, bounce rate healthy."
          action={
            <>
              <Link href="/docs" className="btn btn-ghost">
                Open docs
              </Link>
              <Link href="/api-keys" className="btn btn-primary">
                New API key
              </Link>
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-5 px-8 pt-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            kicker="Sent · 24h"
            value={stats.total.toLocaleString()}
            spark={SAMPLE_SENDS}
          />
          <StatCard
            kicker="Delivered"
            value={
              <>
                {formatPct(stats.delivered, stats.total)}
                <span className="text-[24px] text-fg-3">%</span>
              </>
            }
            spark={SAMPLE_OPENS}
          />
          <StatCard
            kicker="Opens"
            value={
              <>
                {formatPct(stats.opened, stats.total)}
                <span className="text-[24px] text-fg-3">%</span>
              </>
            }
            spark={SAMPLE_CLICKS}
          />
          <StatCard
            kicker="Bounces"
            value={
              <>
                {formatPct(stats.bounced, stats.total)}
                <span className="text-[24px] text-fg-3">%</span>
              </>
            }
            spark={SAMPLE_BOUNCE}
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader
              kicker="// send volume · last 24h"
              title="Hourly sends"
              action={
                <div className="mono flex gap-3.5 text-[11.5px] text-fg-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-accent" />
                    sent
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-violet" />
                    opened
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-red/70" />
                    bounced
                  </span>
                </div>
              }
            />
            <div className="mt-3 flex h-[180px] items-end gap-1.5">
              {SAMPLE_SENDS.map((v, i) => {
                const max = Math.max(...SAMPLE_SENDS);
                const sentH = (v / max) * 100;
                const openH = (SAMPLE_OPENS[i] / max) * 100;
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable sample data
                    key={i}
                    className="group relative flex flex-1 flex-col justify-end gap-px"
                  >
                    <div
                      className="w-full rounded-sm bg-accent/85 transition-opacity group-hover:opacity-100"
                      style={{ height: `${sentH}%`, opacity: 0.85 }}
                    />
                    <div
                      className="w-full rounded-sm bg-violet/60"
                      style={{ height: `${openH * 0.45}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHeader
              kicker="// realtime"
              title="Live activity"
              action={
                <Pill variant="success">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ boxShadow: "0 0 8px var(--accent)" }}
                  />
                  live
                </Pill>
              }
            />
            <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
              {[
                ["delivered", "jane@example.com", "12s"],
                ["opened", "ops@acme.io", "34s"],
                ["delivered", "billing@startup.dev", "1m"],
                ["bounced", "old@ghost.email", "2m"],
                ["delivered", "team@partner.app", "3m"],
              ].map(([event, addr, ago]) => (
                <li
                  key={`${event}-${addr}`}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      event === "bounced" ? "bg-red" : "bg-accent"
                    }`}
                  />
                  <span className="mono text-[11px] uppercase tracking-[0.12em] text-fg-3">
                    {event}
                  </span>
                  <span className="flex-1 truncate text-fg-2">{addr}</span>
                  <span className="mono text-[11px] text-fg-4">{ago}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card>
            <SectionHeader
              kicker="// deliverability"
              title="Reputation by domain"
              action={
                <Link
                  href="/domains"
                  className="mono text-[11.5px] text-fg-3 hover:text-fg-2"
                >
                  view all →
                </Link>
              }
            />
            <div className="mt-3 flex flex-col gap-3.5">
              {domains.map((d) => (
                <div
                  key={d.domain}
                  className="grid grid-cols-[1.4fr_auto_1fr_1fr] items-center gap-4"
                >
                  <span className="mono text-[13.5px] text-fg">{d.domain}</span>
                  <Pill variant={d.status === "verified" ? "success" : "warn"}>
                    {d.status}
                  </Pill>
                  <Meter
                    label="delivered"
                    value={d.delivered}
                    color="var(--accent)"
                    max={100}
                  />
                  <Meter
                    label="opens"
                    value={d.opens}
                    color="var(--violet)"
                    max={60}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader kicker="// quick start" title="Send a test in 30s" />
            <pre className="mono mt-3 overflow-hidden rounded-lg border border-line bg-black/30 px-4 py-3.5 text-[12.5px] leading-[1.7] text-fg-2">
              <span className="text-violet">curl</span> -X POST
              https://api.opensend.dev/emails \{"\n"}
              {"  "}-H{" "}
              <span className="text-accent">
                "Authorization: Bearer os_live_•••"
              </span>{" "}
              \{"\n"}
              {"  "}-d{" "}
              <span className="text-accent">
                {
                  '\'{"from":"hi@acme.com","to":"jane@example.com","subject":"hi","html":"<b>hi</b>"}\''
                }
              </span>
            </pre>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/docs/quickstart" className="btn btn-ghost btn-sm">
                Open docs
              </Link>
              <span className="flex-1" />
              <span className="mono text-[11.5px] text-fg-3">POST /emails</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mono mb-1 text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
        {label}
      </div>
      {value === null ? (
        <span className="text-[12px] text-fg-4">—</span>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (value / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <span className="mono w-10 text-right text-[11.5px] text-fg">
            {value.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
