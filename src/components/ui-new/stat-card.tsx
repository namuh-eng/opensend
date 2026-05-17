import type { ReactNode } from "react";
import { Card } from "./card";
import { Spark } from "./spark";

type StatCardProps = {
  kicker: string;
  value: ReactNode;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
  spark?: number[];
  sub?: ReactNode;
  className?: string;
};

const trendColor = {
  up: "text-accent",
  down: "text-red",
  neutral: "text-fg-3",
} as const;

const trendArrow = {
  up: "↑",
  down: "↓",
  neutral: "·",
} as const;

export function StatCard({
  kicker,
  value,
  delta,
  spark,
  sub,
  className = "",
}: StatCardProps) {
  return (
    <Card padding="md" className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="kicker">{kicker}</span>
        {delta && (
          <span
            className={`mono text-[11px] tracking-wide ${trendColor[delta.trend]}`}
          >
            {trendArrow[delta.trend]} {delta.value}
          </span>
        )}
      </div>
      <div className="serif text-[40px] leading-none tracking-tight text-fg">
        {value}
      </div>
      {spark && (
        <div className="-mx-1 mt-1">
          <Spark values={spark} width={160} height={28} />
        </div>
      )}
      {sub && <div className="mt-1 text-[13px] text-fg-2">{sub}</div>}
    </Card>
  );
}
