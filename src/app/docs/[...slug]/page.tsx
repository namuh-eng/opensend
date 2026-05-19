import { DocsShell } from "@/components/docs/docs-shell";
import { MarkdownContent } from "@/components/docs/markdown-content";
import {
  getAllDocs,
  getDocPage,
  getDocsNav,
  relPathFromSlugParts,
} from "@/lib/docs";
import { notFound, redirect } from "next/navigation";

type DocsRouteProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  const docs = await getAllDocs();
  return docs.map((doc) => ({ slug: doc.slug.split("/") }));
}

export async function generateMetadata({ params }: DocsRouteProps) {
  const { slug } = await params;
  const relPath = relPathFromSlugParts(slug);
  if (!relPath) return { title: "OpenSend Docs" };
  const page = await getDocPage(relPath);
  if (!page) return { title: "OpenSend Docs" };
  return {
    title: `${page.title} · OpenSend Docs`,
    description: page.summary,
  };
}

export default async function DocsMarkdownPage({ params }: DocsRouteProps) {
  const { slug } = await params;
  const relPath = relPathFromSlugParts(slug);
  if (!relPath) notFound();

  if (relPath.endsWith(".md")) {
    const pretty = relPath.replace(/\.md$/, "");
    if (slug.join("/").endsWith(".md")) redirect(`/docs/${pretty}`);
  }

  const [nav, page] = await Promise.all([getDocsNav(), getDocPage(relPath)]);
  if (!page) notFound();

  return (
    <DocsShell nav={nav} activeSlug={page.slug} headings={page.headings}>
      <article className="rounded-[24px] border border-line bg-bg-card p-6 shadow-[0_40px_120px_-90px_rgba(196,255,90,0.6)] sm:p-8 lg:p-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="kicker">OpenSend docs</p>
            <h1 className="mt-3 max-w-3xl text-[40px] font-medium leading-tight tracking-[-0.035em] text-fg sm:text-[52px]">
              {page.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg-2">
              {page.summary}
            </p>
          </div>
          <a className="btn btn-ghost btn-sm" href={page.rawHref}>
            Raw markdown
          </a>
        </div>

        <MarkdownContent markdown={page.markdown} skipFirstH1 />

        <nav
          className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2"
          aria-label="Previous and next docs"
        >
          {page.previous ? (
            <a
              href={page.previous.href}
              className="rounded-card border border-line bg-white/[0.02] p-4 transition hover:border-line-2 hover:bg-white/[0.04]"
            >
              <p className="kicker">Previous</p>
              <p className="mt-2 text-[14px] font-medium text-fg">
                {page.previous.title}
              </p>
            </a>
          ) : (
            <div />
          )}
          {page.next ? (
            <a
              href={page.next.href}
              className="rounded-card border border-line bg-white/[0.02] p-4 text-right transition hover:border-line-2 hover:bg-white/[0.04]"
            >
              <p className="kicker">Next</p>
              <p className="mt-2 text-[14px] font-medium text-fg">
                {page.next.title}
              </p>
            </a>
          ) : null}
        </nav>
      </article>
    </DocsShell>
  );
}
