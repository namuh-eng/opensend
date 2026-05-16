import type { ReactNode } from "react";

type SectionHeaderProps = {
  kicker?: string;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  kicker,
  title,
  sub,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="flex flex-col gap-1.5">
        {kicker && <span className="kicker">{kicker}</span>}
        <div className="text-[18px] font-medium tracking-tight text-fg">
          {title}
        </div>
        {sub && <div className="text-[13px] text-fg-2">{sub}</div>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
