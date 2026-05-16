import type { ReactNode } from "react";

type PageHeaderProps = {
  kicker?: string;
  title: ReactNode;
  serifAccent?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PageHeader({
  kicker,
  title,
  serifAccent,
  sub,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6 ${className}`}
    >
      <div className="flex max-w-2xl flex-col gap-2">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="m-0 text-[34px] leading-[1.05] tracking-[-0.02em] text-fg">
          {title}
          {serifAccent && (
            <>
              {" "}
              <span className="serif text-fg-2">{serifAccent}</span>
            </>
          )}
        </h1>
        {sub && <p className="text-[14px] leading-relaxed text-fg-2">{sub}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  );
}
