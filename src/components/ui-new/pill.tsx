import type { ReactNode } from "react";

export type PillVariant =
  | "neutral"
  | "success"
  | "warn"
  | "error"
  | "info"
  | "violet";

type PillProps = {
  variant?: PillVariant;
  showDot?: boolean;
  children: ReactNode;
  className?: string;
};

const VARIANT: Record<PillVariant, string> = {
  neutral: "pill",
  success: "pill success",
  warn: "pill warn",
  error: "pill error",
  info: "pill info",
  violet: "pill violet",
};

export function Pill({
  variant = "neutral",
  showDot = false,
  children,
  className = "",
}: PillProps) {
  return (
    <span className={`${VARIANT[variant]} ${className}`}>
      {showDot && <span className="dot" />}
      {children}
    </span>
  );
}
