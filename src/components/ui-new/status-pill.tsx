export type StatusKind =
  | "delivered"
  | "sent"
  | "queued"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "delayed"
  | "scheduled"
  | "draft"
  | "sending"
  | "paused"
  | "active"
  | "verified"
  | "pending";

type Variant = "success" | "warn" | "error" | "info" | "violet" | "neutral";

const KIND_MAP: Record<StatusKind, { label: string; variant: Variant }> = {
  delivered: { label: "delivered", variant: "success" },
  sent: { label: "sent", variant: "success" },
  opened: { label: "opened", variant: "info" },
  clicked: { label: "clicked", variant: "violet" },
  queued: { label: "queued", variant: "neutral" },
  scheduled: { label: "scheduled", variant: "info" },
  sending: { label: "sending", variant: "info" },
  delayed: { label: "delayed", variant: "warn" },
  bounced: { label: "bounced", variant: "error" },
  complained: { label: "complained", variant: "error" },
  failed: { label: "failed", variant: "error" },
  draft: { label: "draft", variant: "neutral" },
  paused: { label: "paused", variant: "warn" },
  active: { label: "active", variant: "success" },
  verified: { label: "verified", variant: "success" },
  pending: { label: "pending", variant: "warn" },
};

const VARIANT_CLASS: Record<Variant, string> = {
  success: "pill success",
  warn: "pill warn",
  error: "pill error",
  info: "pill info",
  violet: "pill violet",
  neutral: "pill",
};

type StatusPillProps = {
  status: StatusKind;
  label?: string;
  showDot?: boolean;
  className?: string;
};

export function StatusPill({
  status,
  label,
  showDot = true,
  className = "",
}: StatusPillProps) {
  const entry = KIND_MAP[status];
  return (
    <span className={`${VARIANT_CLASS[entry.variant]} ${className}`}>
      {showDot && <span className="dot" />}
      {label ?? entry.label}
    </span>
  );
}
