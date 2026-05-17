import type { ReactNode } from "react";

type IconProps = { className?: string };

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function svg(children: ReactNode, props: IconProps = {}) {
  return (
    <svg {...baseProps} className={props.className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icon = {
  overview: (p?: IconProps) =>
    svg(
      <>
        <rect x="3" y="3" width="8" height="9" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="14" width="8" height="7" rx="1.5" />
      </>,
      p,
    ),
  emails: (p?: IconProps) =>
    svg(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3 7 9 6 9-6" />
      </>,
      p,
    ),
  broadcasts: (p?: IconProps) =>
    svg(
      <>
        <path d="M4 11v2" />
        <path d="M8 9v6" />
        <path d="M12 6v12" />
        <path d="M16 9v6" />
        <path d="M20 11v2" />
      </>,
      p,
    ),
  automations: (p?: IconProps) =>
    svg(
      <>
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="15" y="3" width="6" height="6" rx="1.5" />
        <rect x="15" y="15" width="6" height="6" rx="1.5" />
        <path d="M9 6h6M18 9v6M15 18H6a3 3 0 0 1-3-3v-3" />
      </>,
      p,
    ),
  templates: (p?: IconProps) =>
    svg(
      <>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <path d="M3 9h18M9 21V9" />
      </>,
      p,
    ),
  audience: (p?: IconProps) =>
    svg(
      <>
        <circle cx="9" cy="9" r="3.5" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M15 19c0-2.5 1.5-4 4-4s2 0 2 0" />
      </>,
      p,
    ),
  metrics: (p?: IconProps) =>
    svg(
      <>
        <path d="M4 4v16h16" />
        <path d="M7 14l3-3 3 3 5-5" />
      </>,
      p,
    ),
  domains: (p?: IconProps) =>
    svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.4 2.5 16.2 0 18M12 3c-2.5 2.4-2.5 16.2 0 18" />
      </>,
      p,
    ),
  logs: (p?: IconProps) =>
    svg(
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 13h8M8 17h6" />
      </>,
      p,
    ),
  audit: (p?: IconProps) =>
    svg(
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </>,
      p,
    ),
  keys: (p?: IconProps) =>
    svg(
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m21 2-11 11M16 8l3 3M14 10l3 3" />
      </>,
      p,
    ),
  webhooks: (p?: IconProps) =>
    svg(
      <>
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="18" r="3" />
        <circle cx="12" cy="6" r="3" />
        <path d="M10.5 8.5 7 16M13.5 8.5 17 16M9 18h6" />
      </>,
      p,
    ),
  billing: (p?: IconProps) =>
    svg(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>,
      p,
    ),
  settings: (p?: IconProps) =>
    svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.36.85.59 1.36.61H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
      p,
    ),
  search: (p?: IconProps) =>
    svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>,
      p,
    ),
  chevR: (p?: IconProps) => svg(<path d="m9 6 6 6-6 6" />, p),
  chevD: (p?: IconProps) => svg(<path d="m6 9 6 6 6-6" />, p),
  bell: (p?: IconProps) =>
    svg(
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>,
      p,
    ),
  more: (p?: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={p?.className}
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
