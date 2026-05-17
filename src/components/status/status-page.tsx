import { StatusPill } from "@/components/ui-new";
import type {
  PublicStatusComponentStatus,
  PublicStatusSnapshot,
} from "@opensend/core";

const STATUS_KIND_MAP: Record<
  PublicStatusComponentStatus,
  "active" | "pending" | "bounced"
> = {
  operational: "active",
  degraded: "pending",
  outage: "bounced",
  unknown: "pending",
};

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function StatusPage({ status }: { status: PublicStatusSnapshot }) {
  return (
    <main
      className="min-h-screen bg-bg text-fg"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in oklch, var(--accent) 12%, transparent) 0%, var(--bg) 34rem)",
      }}
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-4">
            <a className="kicker inline-flex transition hover:text-fg" href="/">
              opensend
            </a>
            <div className="space-y-3">
              <p className="kicker text-accent">Public status</p>
              <h1 className="text-balance font-semibold text-4xl tracking-[-0.04em] md:text-6xl">
                <span className="serif">{status.headline}</span>
              </h1>
              <p className="max-w-2xl text-lg text-fg-2 leading-8">
                {status.message}
              </p>
            </div>
          </div>
          <div className="rounded-card border border-line bg-bg-card px-5 py-4 text-sm text-fg-2">
            <p className="text-fg-4">Last checked</p>
            <p className="font-medium text-fg">
              {formatGeneratedAt(status.generatedAt)} UTC
            </p>
          </div>
        </header>

        <section
          className="grid gap-3 md:grid-cols-3"
          aria-label="Status actions"
        >
          {Object.values(status.actions).map((action) => (
            <a
              className="rounded-card border border-line bg-bg-card p-5 transition hover:border-line-2 hover:bg-bg-2"
              href={action.href}
              key={action.label}
            >
              <span className="font-medium text-fg">{action.label}</span>
              <p className="mt-2 text-sm text-fg-3 leading-6">{action.note}</p>
            </a>
          ))}
        </section>

        <section className="rounded-card border border-line bg-bg-card shadow-2xl shadow-black/20">
          <div className="border-b border-line px-6 py-5">
            <h2 className="font-semibold text-xl text-fg">Components</h2>
            <p className="mt-1 text-sm text-fg-3">
              Live readiness comes from existing OpenSend probes where
              available; uptime is calculated from the incident-history source.
            </p>
          </div>
          <div className="divide-y divide-line">
            {status.components.map((component) => (
              <article
                className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center"
                data-testid={`status-component-${component.id}`}
                key={component.id}
              >
                <div>
                  <h3 className="font-medium text-fg">{component.name}</h3>
                  <p className="mt-1 text-sm text-fg-3 leading-6">
                    {component.description}
                  </p>
                  <p className="mt-2 text-sm text-fg-2">{component.message}</p>
                </div>
                <div className="text-sm text-fg-2 md:text-right">
                  <p className="font-medium text-fg">
                    {component.uptime.label}
                  </p>
                  <p className="text-fg-4">
                    Last {component.uptime.windowDays} days
                  </p>
                </div>
                <StatusPill
                  status={STATUS_KIND_MAP[component.status]}
                  label={component.statusLabel}
                />
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-card border border-line bg-bg-card"
          id="incident-history"
        >
          <div className="border-b border-line px-6 py-5">
            <h2 className="font-semibold text-xl text-fg">Incident history</h2>
            <p className="mt-1 text-sm text-fg-3">
              {status.incidentSource.description}
            </p>
          </div>
          <div className="divide-y divide-line">
            {status.history.map((entry) => (
              <article
                className="grid gap-2 px-6 py-5 sm:grid-cols-[10rem_1fr]"
                data-testid="status-history-row"
                key={entry.id}
              >
                <time className="text-sm text-fg-4" dateTime={entry.date}>
                  {entry.date}
                </time>
                <div>
                  <h3 className="font-medium text-fg">{entry.title}</h3>
                  <p className="mt-1 text-sm text-fg-3">{entry.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
