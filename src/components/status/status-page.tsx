import type {
  PublicStatusComponentStatus,
  PublicStatusSnapshot,
} from "@opensend/core";

const statusClasses = {
  operational: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  outage: "border-red-500/30 bg-red-500/10 text-red-200",
  unknown: "border-slate-500/30 bg-slate-500/10 text-slate-200",
} satisfies Record<PublicStatusComponentStatus, string>;

const dotClasses = {
  operational: "bg-emerald-400",
  degraded: "bg-amber-400",
  outage: "bg-red-400",
  unknown: "bg-slate-400",
} satisfies Record<PublicStatusComponentStatus, string>;

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function StatusPage({ status }: { status: PublicStatusSnapshot }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_34rem),#020617] text-slate-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-6 border-white/10 border-b pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-4">
            <a
              className="inline-flex text-slate-400 text-sm transition hover:text-white"
              href="/"
            >
              opensend
            </a>
            <div className="space-y-3">
              <p className="font-medium text-emerald-300 text-sm uppercase tracking-[0.32em]">
                Public status
              </p>
              <h1 className="text-balance font-semibold text-4xl tracking-[-0.04em] md:text-6xl">
                {status.headline}
              </h1>
              <p className="max-w-2xl text-lg text-slate-300 leading-8">
                {status.message}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
            <p className="text-slate-500">Last checked</p>
            <p className="font-medium text-slate-100">
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
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
              href={action.href}
              key={action.label}
            >
              <span className="font-medium text-white">{action.label}</span>
              <p className="mt-2 text-sm text-slate-400 leading-6">
                {action.note}
              </p>
            </a>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="border-white/10 border-b px-6 py-5">
            <h2 className="font-semibold text-xl">Components</h2>
            <p className="mt-1 text-sm text-slate-400">
              Live readiness comes from existing OpenSend probes where
              available; uptime is calculated from the incident-history source.
            </p>
          </div>
          <div className="divide-y divide-white/10">
            {status.components.map((component) => (
              <article
                className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center"
                data-testid={`status-component-${component.id}`}
                key={component.id}
              >
                <div>
                  <h3 className="font-medium text-white">{component.name}</h3>
                  <p className="mt-1 text-sm text-slate-400 leading-6">
                    {component.description}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {component.message}
                  </p>
                </div>
                <div className="text-sm text-slate-300 md:text-right">
                  <p className="font-medium text-white">
                    {component.uptime.label}
                  </p>
                  <p className="text-slate-500">
                    Last {component.uptime.windowDays} days
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-medium text-sm ${statusClasses[component.status]}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${dotClasses[component.status]}`}
                    aria-hidden="true"
                  />
                  {component.statusLabel}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-3xl border border-white/10 bg-white/[0.04]"
          id="incident-history"
        >
          <div className="border-white/10 border-b px-6 py-5">
            <h2 className="font-semibold text-xl">Incident history</h2>
            <p className="mt-1 text-sm text-slate-400">
              {status.incidentSource.description}
            </p>
          </div>
          <div className="divide-y divide-white/10">
            {status.history.map((entry) => (
              <article
                className="grid gap-2 px-6 py-5 sm:grid-cols-[10rem_1fr]"
                data-testid="status-history-row"
                key={entry.id}
              >
                <time className="text-sm text-slate-500" dateTime={entry.date}>
                  {entry.date}
                </time>
                <div>
                  <h3 className="font-medium text-white">{entry.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{entry.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
