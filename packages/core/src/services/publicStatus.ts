import type { HealthService, HealthStatus } from "./health";

export type PublicStatusComponentId =
  | "app_api"
  | "dashboard"
  | "ingester_webhooks"
  | "database_queue";

export type PublicStatusComponentStatus =
  | "operational"
  | "degraded"
  | "outage"
  | "unknown";

export type PublicStatusOverallStatus = "operational" | "degraded" | "outage";

export type PublicStatusUptime = {
  percentage: number;
  windowDays: number;
  source: "incident-history";
  label: string;
};

export type PublicStatusComponent = {
  id: PublicStatusComponentId;
  name: string;
  description: string;
  status: PublicStatusComponentStatus;
  statusLabel: string;
  message: string;
  lastCheckedAt: string | null;
  uptime: PublicStatusUptime;
};

export type PublicStatusIncidentImpact = "none" | "degraded" | "outage";

export type PublicStatusIncident = {
  id: string;
  date: string;
  title: string;
  status: "resolved" | "monitoring" | "none";
  impact: PublicStatusIncidentImpact;
  affectedComponentIds: PublicStatusComponentId[];
  durationMinutes: number;
  summary: string;
};

export type PublicStatusHistoryRow = {
  id: string;
  date: string;
  title: string;
  summary: string;
  impact: PublicStatusIncidentImpact;
};

export type PublicStatusAction = {
  label: string;
  href: string;
  note: string;
};

export type PublicStatusSnapshot = {
  status: PublicStatusOverallStatus;
  headline: string;
  message: string;
  generatedAt: string;
  components: PublicStatusComponent[];
  history: PublicStatusHistoryRow[];
  incidentSource: {
    type: "empty-in-repo-source";
    description: string;
  };
  actions: {
    subscribe: PublicStatusAction;
    report: PublicStatusAction;
    history: PublicStatusAction;
  };
};

export type StatusProbeResult = {
  ok: boolean;
};

export type PublicStatusServiceDependencies = {
  health: HealthService;
  ingesterProbe?: () => Promise<StatusProbeResult>;
  queueConfigured?: () => boolean;
  now?: () => Date;
  incidents?: PublicStatusIncident[];
};

const COMPONENT_IDS: PublicStatusComponentId[] = [
  "app_api",
  "dashboard",
  "ingester_webhooks",
  "database_queue",
];
const UPTIME_WINDOW_DAYS = 90;
const EMPTY_HISTORY_DAYS = 3;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - days,
    ),
  );
}

function statusLabel(status: PublicStatusComponentStatus): string {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "outage":
      return "Outage";
    case "unknown":
      return "Probe not configured";
  }
}

function isHealthOk(health: HealthStatus): boolean {
  return health.status === "ok" && health.db === "connected";
}

function calculateIncidentUptime(
  componentId: PublicStatusComponentId,
  incidents: PublicStatusIncident[],
): PublicStatusUptime {
  const downtimeMinutes = incidents
    .filter((incident) => incident.affectedComponentIds.includes(componentId))
    .reduce((total, incident) => total + incident.durationMinutes, 0);
  const windowMinutes = UPTIME_WINDOW_DAYS * 24 * 60;
  const uptime = Math.max(0, 100 - (downtimeMinutes / windowMinutes) * 100);

  return {
    percentage: Number(uptime.toFixed(2)),
    windowDays: UPTIME_WINDOW_DAYS,
    source: "incident-history",
    label: `${Number(uptime.toFixed(2)).toFixed(2)}% uptime`,
  };
}

function noIncidentHistory(now: Date): PublicStatusHistoryRow[] {
  return Array.from({ length: EMPTY_HISTORY_DAYS }, (_, index) => {
    const date = toIsoDate(subtractUtcDays(now, index));
    return {
      id: `no-incidents-${date}`,
      date,
      title: "No incidents",
      summary: "No incidents recorded for OpenSend components.",
      impact: "none" as const,
    };
  });
}

function historyRows(
  incidents: PublicStatusIncident[],
  now: Date,
): PublicStatusHistoryRow[] {
  if (incidents.length === 0) return noIncidentHistory(now);

  return incidents.map((incident) => ({
    id: incident.id,
    date: incident.date,
    title: incident.title,
    summary: incident.summary,
    impact: incident.impact,
  }));
}

function overallStatus(
  components: PublicStatusComponent[],
): PublicStatusOverallStatus {
  if (components.some((component) => component.status === "outage")) {
    return "outage";
  }
  if (components.some((component) => component.status === "degraded")) {
    return "degraded";
  }
  return "operational";
}

function overallCopy(status: PublicStatusOverallStatus): {
  headline: string;
  message: string;
} {
  switch (status) {
    case "operational":
      return {
        headline: "Core systems operational",
        message:
          "We are not aware of any incidents affecting monitored OpenSend systems. Components without a configured live probe are labeled explicitly.",
      };
    case "degraded":
      return {
        headline: "Some systems are degraded",
        message:
          "One or more monitored OpenSend components is not reporting healthy. We keep raw dependency errors private and show coarse public status only.",
      };
    case "outage":
      return {
        headline: "Service disruption detected",
        message:
          "A monitored OpenSend dependency is currently unavailable. Public status details are intentionally coarse.",
      };
  }
}

function component(
  input: Omit<PublicStatusComponent, "statusLabel" | "uptime">,
  incidents: PublicStatusIncident[],
): PublicStatusComponent {
  return {
    ...input,
    statusLabel: statusLabel(input.status),
    uptime: calculateIncidentUptime(input.id, incidents),
  };
}

async function checkIngester(
  probe: (() => Promise<StatusProbeResult>) | undefined,
): Promise<PublicStatusComponentStatus> {
  if (!probe) return "unknown";

  try {
    const result = await probe();
    return result.ok ? "operational" : "degraded";
  } catch {
    return "degraded";
  }
}

export function createPublicStatusService(
  dependencies: PublicStatusServiceDependencies,
) {
  return {
    async snapshot(): Promise<PublicStatusSnapshot> {
      const now = dependencies.now?.() ?? new Date();
      const generatedAt = now.toISOString();
      const incidents = dependencies.incidents ?? [];
      const health = await dependencies.health.check();
      const healthOk = isHealthOk(health);
      const queueConfigured = dependencies.queueConfigured?.() ?? false;
      const ingesterStatus = await checkIngester(dependencies.ingesterProbe);

      const components: PublicStatusComponent[] = [
        component(
          {
            id: "app_api",
            name: "App / API",
            description: "Next.js application shell and public API runtime.",
            status: healthOk ? "operational" : "outage",
            message: healthOk
              ? "Application runtime and database-backed API probe are reachable."
              : "The public API health probe cannot reach its database dependency.",
            lastCheckedAt: generatedAt,
          },
          incidents,
        ),
        component(
          {
            id: "dashboard",
            name: "Dashboard",
            description: "Authenticated OpenSend dashboard routes.",
            status: healthOk ? "operational" : "outage",
            message: healthOk
              ? "Dashboard runtime shares the healthy application readiness probe."
              : "Dashboard readiness is affected by the application/database outage.",
            lastCheckedAt: generatedAt,
          },
          incidents,
        ),
        component(
          {
            id: "ingester_webhooks",
            name: "Ingester / Webhooks",
            description:
              "SES/SNS ingestion, webhook dispatch, and background workers.",
            status: ingesterStatus,
            message:
              ingesterStatus === "unknown"
                ? "Set INGESTER_HEALTH_URL to expose the ingester /health probe here."
                : ingesterStatus === "operational"
                  ? "Configured ingester health probe is reachable."
                  : "Configured ingester health probe is not reporting healthy.",
            lastCheckedAt: dependencies.ingesterProbe ? generatedAt : null,
          },
          incidents,
        ),
        component(
          {
            id: "database_queue",
            name: "Database / Queue",
            description:
              "Postgres readiness and background job queue configuration.",
            status: healthOk
              ? queueConfigured
                ? "operational"
                : "unknown"
              : "outage",
            message: healthOk
              ? queueConfigured
                ? "Database probe passed and a background job queue URL is configured."
                : "Database probe passed; queue readiness is not configured for this deployment."
              : "Database probe failed, so queue-backed work may also be affected.",
            lastCheckedAt: generatedAt,
          },
          incidents,
        ),
      ];

      const status = overallStatus(components);
      const copy = overallCopy(status);

      return {
        status,
        headline: copy.headline,
        message: copy.message,
        generatedAt,
        components: components.filter((entry) =>
          COMPONENT_IDS.includes(entry.id),
        ),
        history: historyRows(incidents, now),
        incidentSource: {
          type: "empty-in-repo-source",
          description:
            "This first public status slice has no durable incident store yet; history is generated from the in-repo incident source until an incident workflow is added.",
        },
        actions: {
          subscribe: {
            label: "Subscribe to updates",
            href: "#subscribe-placeholder",
            note: "Subscription delivery is a placeholder until OpenSend wires a notification workflow.",
          },
          report: {
            label: "Report a problem",
            href: "https://github.com/namuh-eng/opensend/issues/new?title=Status%20report",
            note: "Report public incidents through GitHub until a dedicated incident intake exists.",
          },
          history: {
            label: "View history",
            href: "#incident-history",
            note: "History currently reflects the documented empty incident source.",
          },
        },
      };
    },
  };
}
