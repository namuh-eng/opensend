import { headingId } from "@/lib/docs";
import type { ReactNode } from "react";

type MarkdownBlock =
  | { kind: "heading"; depth: 1 | 2 | 3 | 4; text: string; id: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "blockquote"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "rule" };

function stripInlineMarkers(value: string) {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/_([^_]+)_/g, "$1");
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] text-fg"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-fg">
          {stripInlineMarkers(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith("_")) {
      nodes.push(
        <em key={key} className="text-fg">
          {stripInlineMarkers(token.slice(1, -1))}
        </em>,
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^\)]+)\)$/.exec(token);
      if (linkMatch) {
        const href = linkMatch[2];
        nodes.push(
          <a
            key={key}
            href={href}
            className="text-accent underline decoration-accent/30 underline-offset-4 transition hover:text-accent-2"
          >
            {linkMatch[1]}
          </a>,
        );
      }
    }
    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function makeHeadingId(text: string, seen: Map<string, number>) {
  const base = headingId(text) || "section";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  const headingIds = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", language, code: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const depth = headingMatch[1].length as 1 | 2 | 3 | 4;
      const text = headingMatch[2].replace(/\s+#+$/, "").trim();
      blocks.push({
        kind: "heading",
        depth,
        text,
        id: makeHeadingId(text, headingIds),
      });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (
      index + 1 < lines.length &&
      trimmed.includes("|") &&
      isTableSeparator(lines[index + 1])
    ) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const itemMatch = ordered
          ? /^\d+\.\s+(.+)$/.exec(itemLine)
          : /^[-*]\s+(.+)$/.exec(itemLine);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (
        !next ||
        next.startsWith("#") ||
        next.startsWith("```") ||
        next.startsWith(">") ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^---+$/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function Heading({
  block,
}: { block: Extract<MarkdownBlock, { kind: "heading" }> }) {
  const content = parseInline(block.text);
  if (block.depth === 1) {
    return (
      <h1 className="text-[40px] font-medium leading-tight tracking-[-0.035em] text-fg sm:text-[52px]">
        {content}
      </h1>
    );
  }
  if (block.depth === 2) {
    return (
      <h2
        id={block.id}
        className="scroll-mt-28 pt-7 text-[28px] font-medium tracking-[-0.025em] text-fg"
      >
        {content}
      </h2>
    );
  }
  if (block.depth === 3) {
    return (
      <h3
        id={block.id}
        className="scroll-mt-28 pt-4 text-[20px] font-medium tracking-[-0.015em] text-fg"
      >
        {content}
      </h3>
    );
  }
  return <h4 className="pt-3 text-[16px] font-semibold text-fg">{content}</h4>;
}

export function MarkdownContent({
  markdown,
  skipFirstH1 = false,
}: {
  markdown: string;
  skipFirstH1?: boolean;
}) {
  const parsedBlocks = parseMarkdown(markdown);
  let blocks = parsedBlocks;
  if (
    skipFirstH1 &&
    parsedBlocks[0]?.kind === "heading" &&
    parsedBlocks[0].depth === 1
  ) {
    blocks = parsedBlocks.slice(1);
    if (blocks[0]?.kind === "paragraph") {
      blocks = blocks.slice(1);
    }
  }
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "heading")
          return <Heading key={key} block={block} />;
        if (block.kind === "paragraph") {
          return (
            <p key={key} className="max-w-3xl text-[15px] leading-7 text-fg-2">
              {parseInline(block.text)}
            </p>
          );
        }
        if (block.kind === "code") {
          return (
            <div
              key={key}
              className="overflow-hidden rounded-card border border-line bg-[#08080a]"
            >
              {block.language ? (
                <div className="border-b border-line bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-3">
                  {block.language}
                </div>
              ) : null}
              <pre className="overflow-x-auto p-4 text-[12.5px] leading-6 text-fg-2">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }
        if (block.kind === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={key}
              className={`max-w-3xl space-y-2 pl-5 text-[15px] leading-7 text-fg-2 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item) => (
                <li key={item}>{parseInline(item)}</li>
              ))}
            </ListTag>
          );
        }
        if (block.kind === "blockquote") {
          return (
            <blockquote
              key={key}
              className="max-w-3xl rounded-card border border-accent/20 bg-accent-soft px-4 py-3 text-[14px] leading-7 text-fg-2"
            >
              {parseInline(block.text)}
            </blockquote>
          );
        }
        if (block.kind === "table") {
          return (
            <div
              key={key}
              className="overflow-x-auto rounded-card border border-line"
            >
              <table className="w-full min-w-[560px] border-collapse text-left text-[13px] text-fg-2">
                <thead className="bg-white/[0.03] text-fg">
                  <tr>
                    {block.headers.map((header) => (
                      <th
                        key={header}
                        className="border-b border-line px-4 py-3 font-medium"
                      >
                        {parseInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => {
                    const rowKey = row.join("|");
                    return (
                      <tr
                        key={`${key}-row-${rowKey}`}
                        className="border-b border-line last:border-0"
                      >
                        {row.map((cell) => (
                          <td
                            key={`${key}-cell-${rowKey}-${cell}`}
                            className="px-4 py-3 align-top"
                          >
                            {parseInline(cell)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
        return <hr key={key} className="border-line" />;
      })}
    </div>
  );
}
