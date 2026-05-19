import type { DocsHeading, DocsNavSection } from "@/lib/docs";
import type { ReactNode } from "react";

type DocsShellProps = {
  nav: DocsNavSection[];
  activeSlug?: string;
  headings?: DocsHeading[];
  children: ReactNode;
};

function groupLabel(relPath: string) {
  const parts = relPath.split("/");
  if (parts.length <= 2) return null;
  return parts[1]?.replace(/-/g, " ") ?? null;
}

export function DocsShell({
  nav,
  activeSlug,
  headings = [],
  children,
}: DocsShellProps) {
  return (
    <main className="landing-root min-h-screen">
      <div className="grain" aria-hidden />
      <div className="ambient" aria-hidden />
      <div className="landing-content">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between px-5 lg:px-8">
            <a
              href="/docs"
              className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-fg"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
                O
              </span>
              OpenSend Docs
            </a>
            <nav className="hidden items-center gap-5 text-[13px] text-fg-3 md:flex">
              <a
                className="transition hover:text-fg"
                href="/docs/api-reference/introduction"
              >
                API reference
              </a>
              <a
                className="transition hover:text-fg"
                href="/docs/send-with-nodejs"
              >
                SDKs
              </a>
              <a className="transition hover:text-fg" href="/openapi.json">
                OpenAPI
              </a>
              <a className="transition hover:text-fg" href="/docs/llms.txt">
                llms.txt
              </a>
              <a
                className="rounded-md border border-line-2 px-3 py-1.5 text-fg transition hover:border-line-3"
                href="/auth"
              >
                Dashboard
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1500px] gap-7 px-5 py-8 lg:px-8 xl:grid-cols-[286px_minmax(0,1fr)] 2xl:grid-cols-[286px_minmax(0,1fr)_240px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
              <a
                href="/docs"
                className={`mb-3 block rounded-card border px-3 py-3 transition ${activeSlug ? "border-line bg-white/[0.02] text-fg-2 hover:text-fg" : "border-accent/25 bg-accent-soft text-accent"}`}
              >
                <span className="kicker">Overview</span>
                <span className="mt-1 block text-[13px] font-medium">
                  Start here
                </span>
              </a>
              <nav className="space-y-4" aria-label="Documentation">
                {nav.map((section) => (
                  <section
                    key={section.id}
                    className="rounded-card border border-line bg-white/[0.018] p-3"
                  >
                    <div className="px-1 pb-2">
                      <p className="kicker">{section.title}</p>
                      <p className="mt-1 text-[11.5px] leading-5 text-fg-3">
                        {section.description}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = item.slug === activeSlug;
                        const label = groupLabel(item.relPath);
                        return (
                          <a
                            key={item.relPath}
                            href={item.href}
                            className={`block rounded-md px-2.5 py-2 text-[12.5px] leading-5 transition ${active ? "bg-accent text-accent-ink" : "text-fg-3 hover:bg-white/[0.04] hover:text-fg"}`}
                          >
                            {label ? (
                              <span
                                className={`mb-0.5 block text-[10px] capitalize ${active ? "text-accent-ink/70" : "text-fg-4"}`}
                              >
                                {label}
                              </span>
                            ) : null}
                            <span>{item.title}</span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">{children}</div>

          <aside className="hidden 2xl:block">
            <div className="sticky top-24 space-y-3">
              <div className="rounded-card border border-line bg-bg-card p-4">
                <p className="kicker">On this page</p>
                {headings.length > 0 ? (
                  <nav className="mt-3 space-y-1" aria-label="Page sections">
                    {headings.slice(0, 18).map((heading) => (
                      <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={`block rounded-md py-1.5 text-[12.5px] leading-5 text-fg-3 transition hover:text-fg ${heading.depth === 3 ? "pl-4" : "pl-0"}`}
                      >
                        {heading.text}
                      </a>
                    ))}
                  </nav>
                ) : (
                  <p className="mt-3 text-[12.5px] leading-6 text-fg-3">
                    Choose a guide from the sidebar or start with the first
                    email path.
                  </p>
                )}
              </div>
              <div className="rounded-card border border-line bg-bg-card p-4">
                <p className="kicker">Contracts</p>
                <div className="mt-3 space-y-2 text-[13px]">
                  <a
                    className="block text-fg-2 transition hover:text-fg"
                    href="/openapi.json"
                  >
                    OpenAPI JSON
                  </a>
                  <a
                    className="block text-fg-2 transition hover:text-fg"
                    href="/docs/llms.txt"
                  >
                    LLM docs index
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
