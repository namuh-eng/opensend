"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BroadcastEditorSidebar,
  type BroadcastStyle,
  DEFAULT_BROADCAST_STYLE,
} from "./broadcast-editor-sidebar";

// Block types for the editor
type BlockType =
  | "text"
  | "title"
  | "subtitle"
  | "heading"
  | "bullet_list"
  | "numbered_list"
  | "quote"
  | "code_block"
  | "image"
  | "youtube"
  | "twitter"
  | "button"
  | "divider"
  | "section"
  | "columns"
  | "social_links"
  | "unsubscribe_footer"
  | "html"
  | "variable";

interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
}

const SLASH_MENU_ITEMS: {
  category: string;
  items: { type: BlockType; label: string; icon: string }[];
}[] = [
  {
    category: "Text",
    items: [
      { type: "text", label: "Text", icon: "T" },
      { type: "title", label: "Title", icon: "H1" },
      { type: "subtitle", label: "Subtitle", icon: "H2" },
      { type: "heading", label: "Heading", icon: "H3" },
      { type: "bullet_list", label: "Bullet list", icon: "•" },
      { type: "numbered_list", label: "Numbered list", icon: "1." },
      { type: "quote", label: "Quote", icon: "❝" },
      { type: "code_block", label: "Code block", icon: "</>" },
    ],
  },
  {
    category: "Media",
    items: [
      { type: "image", label: "Image", icon: "🖼" },
      { type: "youtube", label: "YouTube", icon: "▶" },
      { type: "twitter", label: "X/Twitter", icon: "𝕏" },
    ],
  },
  {
    category: "Layout",
    items: [
      { type: "button", label: "Button", icon: "▢" },
      { type: "divider", label: "Divider", icon: "—" },
      { type: "section", label: "Section", icon: "☐" },
      { type: "columns", label: "Columns", icon: "▥" },
      { type: "social_links", label: "Social Links", icon: "🔗" },
      {
        type: "unsubscribe_footer",
        label: "Unsubscribe Footer",
        icon: "✉",
      },
    ],
  },
  {
    category: "Utility",
    items: [
      { type: "html", label: "HTML", icon: "<>" },
      { type: "variable", label: "Variable", icon: "{}" },
    ],
  },
];

const VARIABLES = [
  { label: "{{{contact.first_name}}}", value: "{{{contact.first_name}}}" },
  { label: "{{{contact.last_name}}}", value: "{{{contact.last_name}}}" },
  { label: "{{{contact.email}}}", value: "{{{contact.email}}}" },
  {
    label: "{{{contact.company_name}}}",
    value: "{{{contact.company_name}}}",
  },
  {
    label: "{{{RESEND_UNSUBSCRIBE_URL}}}",
    value: "{{{RESEND_UNSUBSCRIBE_URL}}}",
  },
];

const COMPONENT_ITEMS = (
  SLASH_MENU_ITEMS.find((c) => c.category === "Layout")?.items ?? []
).concat(
  (SLASH_MENU_ITEMS.find((c) => c.category === "Utility")?.items ?? []).filter(
    (i) => i.type === "html" || i.type === "code_block",
  ),
);

interface BroadcastData {
  id: string;
  name: string;
  from: string;
  replyTo: string;
  subject: string;
  previewText: string;
  html: string;
  status: string;
  segmentId: string | null;
  topicId: string | null;
  scheduledAt: string | null;
}

interface Domain {
  id: string;
  name: string;
  status: string;
}

interface Segment {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
}

export function BroadcastEditor({
  broadcastId,
}: {
  broadcastId: string;
}) {
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Form state
  const [name, setName] = useState("Untitled");
  const [from, setFrom] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [to, setTo] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  // Toggle states for optional fields
  const [showReplyTo, setShowReplyTo] = useState(false);
  const [showWhen, setShowWhen] = useState(false);
  const [showPreviewText, setShowPreviewText] = useState(false);

  // Autocomplete states
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);

  // Block editor state
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [activeToolbarTab, setActiveToolbarTab] = useState<
    "text" | "image" | "components" | "variables"
  >("text");

  // Right sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [broadcastStyle, setBroadcastStyle] = useState<BroadcastStyle>(
    DEFAULT_BROADCAST_STYLE,
  );

  // Review panel state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Load broadcast data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/broadcasts/${broadcastId}`);
        if (res.ok) {
          const data = await res.json();
          setBroadcast(data);
          setName(data.name || "Untitled");
          setFrom(data.from || "");
          setReplyTo(data.replyTo || "");
          setSubject(data.subject || "");
          setPreviewText(data.previewText || "");
          setSegmentId(data.segmentId);
          setTopicId(data.topicId);
          if (data.scheduledAt) {
            setScheduledAt(data.scheduledAt);
            setShowWhen(true);
          }
          if (data.replyTo) setShowReplyTo(true);
          if (data.previewText) setShowPreviewText(true);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [broadcastId]);

  // Load domains, segments, topics
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const apiKey =
          typeof window !== "undefined"
            ? (localStorage?.getItem?.("api_key") ?? null)
            : null;
        const authHeaders: Record<string, string> = {};
        if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
        const [domainsRes, segmentsRes, topicsRes] = await Promise.all([
          fetch("/api/domains", { headers: authHeaders }),
          fetch("/api/segments?limit=100", { headers: authHeaders }),
          fetch("/api/topics?limit=100", { headers: authHeaders }),
        ]);
        if (domainsRes.ok) {
          const d = await domainsRes.json();
          setDomains(d.data || []);
        }
        if (segmentsRes.ok) {
          const s = await segmentsRes.json();
          setSegments(s.data || []);
        }
        if (topicsRes.ok) {
          const t = await topicsRes.json();
          setTopics(t.data || []);
        }
      } catch {
        // ignore
      }
    };
    loadOptions();
  }, []);

  // Close topic dropdown and slash menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        topicDropdownRef.current &&
        !topicDropdownRef.current.contains(e.target as Node)
      ) {
        setTopicDropdownOpen(false);
      }
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node)
      ) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const insertBlock = (type: BlockType) => {
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: "",
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSlashMenuOpen(false);
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/") {
      setSlashMenuOpen(true);
    }
    if (e.key === "Escape") {
      setSlashMenuOpen(false);
    }
  };

  // Auto-save
  const autoSave = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await fetch(`/api/broadcasts/${broadcastId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        } catch {
          // ignore
        }
      }, 1000);
    },
    [broadcastId],
  );

  const verifiedDomains = domains.filter((d) => d.status === "verified");
  const fromSuggestions = verifiedDomains.map((d) => `@${d.name}`);

  const filteredSegments = segments.filter(
    (s) => !to || s.name.toLowerCase().includes(to.toLowerCase()),
  );

  const selectedTopic = topics.find((t) => t.id === topicId);
  const selectedSegment = segments.find((s) => s.id === segmentId);
  const hasManagedUnsubscribeLink =
    (broadcast?.html?.includes("{{{RESEND_UNSUBSCRIBE_URL}}}") ?? false) ||
    blocks.some(
      (block) =>
        block.type === "unsubscribe_footer" ||
        block.content.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"),
    );

  const statusLabel = broadcast?.status
    ? broadcast.status.charAt(0).toUpperCase() + broadcast.status.slice(1)
    : "Draft";

  return (
    <div className="flex flex-col h-full min-h-screen bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-line">
        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts"
            className="p-1.5 rounded hover:bg-white/[0.08] text-fg-2 hover:text-fg transition-colors"
            aria-label="Back to broadcasts"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link
            href="/broadcasts"
            className="text-[13px] text-fg-2 hover:text-fg transition-colors"
          >
            Broadcasts
          </Link>
          <span className="text-[13px] text-fg-4">/</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              autoSave({ name: e.target.value });
            }}
            onBlur={() => autoSave({ name })}
            className="text-[13px] text-fg bg-transparent border-none outline-none font-medium min-w-[80px] max-w-[300px]"
          />
          <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.08] text-fg-2 font-medium">
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Page style"
            className={`h-8 px-3 text-[13px] font-medium border rounded-md transition-colors flex items-center gap-1.5 ${
              sidebarOpen
                ? "text-fg border-line-3 bg-white/[0.08]"
                : "text-fg-2 border-line hover:text-fg hover:border-line-3"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Page style
          </button>
          <button
            type="button"
            className="h-8 px-3 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors flex items-center gap-1.5"
          >
            Test email
          </button>
          <button
            type="button"
            onClick={() => setReviewOpen(!reviewOpen)}
            className={`h-8 px-4 text-[13px] font-medium rounded-md transition-colors ${
              reviewOpen
                ? "bg-white text-black"
                : "bg-white text-black hover:bg-gray-200"
            }`}
          >
            Review
          </button>
        </div>
      </div>

      {/* Editor content + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div className="max-w-[700px] mx-auto py-8 px-6">
            {/* Form fields */}
            <div className="space-y-0">
              {/* From */}
              <div className="flex items-start border-b border-line py-3 relative">
                <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                  From
                </span>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={from}
                    placeholder="Acme <acme@example.com>"
                    onChange={(e) => {
                      setFrom(e.target.value);
                      autoSave({ from: e.target.value });
                    }}
                    onFocus={() => setFromFocused(true)}
                    onBlur={() => setTimeout(() => setFromFocused(false), 200)}
                    className="w-full text-[14px] text-fg bg-transparent border-none outline-none placeholder-[#666]"
                  />
                  {fromFocused && fromSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-bg-card border border-line rounded-md shadow-lg z-50 py-1">
                      {fromSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const newFrom = from
                              ? `${from.split("@")[0]}${s}`
                              : `sender${s}`;
                            setFrom(newFrom);
                            autoSave({
                              from: newFrom,
                            });
                            setFromFocused(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!showReplyTo && (
                  <button
                    type="button"
                    onClick={() => setShowReplyTo(true)}
                    className="text-[13px] text-fg-2 hover:text-fg transition-colors shrink-0 ml-2"
                  >
                    Reply-To
                  </button>
                )}
              </div>

              {/* Reply-To (toggleable) */}
              {showReplyTo && (
                <div className="flex items-start border-b border-line py-3">
                  <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                    Reply-To
                  </span>
                  <input
                    type="text"
                    value={replyTo}
                    placeholder="reply@example.com"
                    onChange={(e) => {
                      setReplyTo(e.target.value);
                      autoSave({
                        replyTo: e.target.value,
                      });
                    }}
                    className="flex-1 text-[14px] text-fg bg-transparent border-none outline-none placeholder-[#666]"
                  />
                </div>
              )}

              {/* To */}
              <div className="flex items-start border-b border-line py-3 relative">
                <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                  To
                </span>
                <div className="flex-1 relative">
                  {segmentId && selectedSegment ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] text-fg bg-white/[0.08] px-2 py-0.5 rounded inline-flex items-center gap-1">
                        {selectedSegment.name}
                        <button
                          type="button"
                          onClick={() => {
                            setSegmentId(null);
                            setTo("");
                            autoSave({
                              segmentId: null,
                            });
                          }}
                          className="text-fg-2 hover:text-fg ml-0.5"
                        >
                          &times;
                        </button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={to}
                        placeholder="Select a segment..."
                        onChange={(e) => setTo(e.target.value)}
                        onFocus={() => setToFocused(true)}
                        onBlur={() =>
                          setTimeout(() => setToFocused(false), 200)
                        }
                        className="w-full text-[14px] text-fg bg-transparent border-none outline-none placeholder-[#666]"
                      />
                      {toFocused && filteredSegments.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-bg-card border border-line rounded-md shadow-lg z-50 py-1">
                          {filteredSegments.map((seg) => (
                            <button
                              key={seg.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSegmentId(seg.id);
                                setTo(seg.name);
                                autoSave({
                                  segmentId: seg.id,
                                });
                                setToFocused(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                            >
                              {seg.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {!showWhen && (
                  <button
                    type="button"
                    onClick={() => setShowWhen(true)}
                    className="text-[13px] text-fg-2 hover:text-fg transition-colors shrink-0 ml-2"
                  >
                    When
                  </button>
                )}
              </div>

              {/* When (toggleable) */}
              {showWhen && (
                <div className="flex items-start border-b border-line py-3">
                  <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                    When
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => {
                      setScheduledAt(e.target.value);
                      autoSave({
                        scheduledAt: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      });
                    }}
                    className="flex-1 text-[14px] text-fg bg-transparent border-none outline-none [color-scheme:dark]"
                  />
                </div>
              )}

              {/* Subscribe to */}
              <div
                className="flex items-start border-b border-line py-3 relative"
                ref={topicDropdownRef}
              >
                <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                  Subscribe to
                </span>
                <div className="flex-1 relative">
                  <button
                    type="button"
                    onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
                    className="flex items-center gap-1 text-[14px] text-fg-2 hover:text-fg transition-colors"
                  >
                    <span>
                      {selectedTopic ? selectedTopic.name : "Select a topic"}
                    </span>
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {topicDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-[240px] bg-bg-card border border-line rounded-md shadow-lg z-50 py-1">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTopicId(null);
                          autoSave({ topicId: null });
                          setTopicDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${!topicId ? "text-fg" : "text-fg-2"}`}
                      >
                        None
                      </button>
                      {topics.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setTopicId(t.id);
                            autoSave({
                              topicId: t.id,
                            });
                            setTopicDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${topicId === t.id ? "text-fg" : "text-fg-2"}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="flex items-start border-b border-line py-3">
                <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                  Subject
                </span>
                <div className="flex-1 flex items-center">
                  <input
                    type="text"
                    value={subject}
                    placeholder="Subject"
                    onChange={(e) => {
                      setSubject(e.target.value);
                      autoSave({
                        subject: e.target.value,
                      });
                    }}
                    className="flex-1 text-[14px] text-fg bg-transparent border-none outline-none placeholder-[#666]"
                  />
                  {!showPreviewText && (
                    <button
                      type="button"
                      onClick={() => setShowPreviewText(true)}
                      className="text-[13px] text-fg-2 hover:text-fg transition-colors shrink-0 ml-2"
                    >
                      Preview text
                    </button>
                  )}
                </div>
              </div>

              {/* Preview text (toggleable) */}
              {showPreviewText && (
                <div className="flex items-start border-b border-line py-3">
                  <span className="text-[13px] text-fg-2 w-[100px] pt-1 shrink-0">
                    Preview text
                  </span>
                  <input
                    type="text"
                    value={previewText}
                    placeholder="Preview text (max 150 characters)"
                    maxLength={150}
                    onChange={(e) => {
                      setPreviewText(e.target.value);
                      autoSave({
                        previewText: e.target.value,
                      });
                    }}
                    className="flex-1 text-[14px] text-fg bg-transparent border-none outline-none placeholder-[#666]"
                  />
                </div>
              )}
            </div>

            {/* Block Editor */}
            <div className="mt-8 relative">
              <div
                data-testid="block-editor"
                className="min-h-[400px] border border-line rounded-lg p-4 relative"
                onKeyDown={handleEditorKeyDown}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: editor needs keyboard focus for slash commands
                tabIndex={0}
                aria-label="Content editor"
              >
                {blocks.length === 0 && !slashMenuOpen && (
                  <p className="text-[14px] text-fg-4">
                    Press &apos;/&apos; for commands
                  </p>
                )}

                {/* Rendered blocks */}
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    data-testid={`block-${block.type}`}
                    className="group relative mb-3"
                  >
                    <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-0.5 text-fg-4 hover:text-red-400 text-xs"
                        title="Remove block"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <BlockRenderer
                      block={block}
                      onUpdate={(content) =>
                        updateBlockContent(block.id, content)
                      }
                    />
                  </div>
                ))}

                {/* Slash command menu */}
                {slashMenuOpen && (
                  <div
                    ref={slashMenuRef}
                    className="absolute left-4 z-50 w-[280px] max-h-[360px] overflow-y-auto bg-bg-card border border-line rounded-lg shadow-xl"
                    style={{
                      top:
                        blocks.length > 0
                          ? `${blocks.length * 48 + 16}px`
                          : "16px",
                    }}
                  >
                    {SLASH_MENU_ITEMS.map((category) => (
                      <div key={category.category}>
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-fg-4 uppercase tracking-wider">
                          {category.category}
                        </div>
                        {category.items.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => insertBlock(item.type)}
                            className="w-full px-3 py-2 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors flex items-center gap-2.5"
                          >
                            <span className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.06] text-[11px] font-mono shrink-0">
                              {item.icon}
                            </span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pick a template / Upload HTML */}
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                  Pick a template
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload HTML
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        {sidebarOpen && (
          <BroadcastEditorSidebar
            style={broadcastStyle}
            onChange={setBroadcastStyle}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* Review Panel */}
      {reviewOpen && (
        <div
          data-testid="review-panel"
          className="border-t border-line bg-bg-card px-6 py-5"
        >
          <div className="max-w-[500px] mx-auto">
            <h3 className="text-[16px] font-semibold text-fg mb-4">
              Ready to send?
            </h3>

            {/* Checklist */}
            <div className="space-y-2.5 mb-5">
              {[
                {
                  label: 'Add a "from" address to continue',
                  passed: !!from,
                },
                {
                  label: "Select a recipient segment",
                  passed: !!segmentId,
                },
                {
                  label: "Add a subject line to continue",
                  passed: !!subject,
                },
                {
                  label: "No contacts in this segment",
                  passed: !!segmentId,
                },
                {
                  label: "No unsubscribe link detected",
                  passed: hasManagedUnsubscribeLink,
                  isWarning: true,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 text-[13px]"
                >
                  {item.passed ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-green-500 shrink-0"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M9 12l2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`${item.isWarning ? "text-yellow-500" : "text-red-500"} shrink-0`}
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span className={item.passed ? "text-fg-2" : "text-fg"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Slide to send */}
            <div className="flex items-center gap-3 bg-white/[0.03] border border-line rounded-lg px-4 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-fg-2 shrink-0"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSliderValue(val);
                  if (val >= 100) {
                    // Send the broadcast
                    fetch(`/api/broadcasts/${broadcastId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "sent" }),
                    });
                    setReviewOpen(false);
                    setSliderValue(0);
                  }
                }}
                onMouseUp={() => {
                  if (sliderValue < 100) setSliderValue(0);
                }}
                onTouchEnd={() => {
                  if (sliderValue < 100) setSliderValue(0);
                }}
                aria-label="Slide to send"
                className="flex-1 h-2 appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
              />
              <span className="text-[13px] text-fg-2 shrink-0 min-w-[100px]">
                Slide to send
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="border-t border-line bg-bg-card">
        {/* Toolbar tabs */}
        <div className="flex items-center border-b border-line px-4">
          {(
            [
              { key: "text", label: "Text" },
              { key: "image", label: "Image" },
              { key: "components", label: "Components" },
              { key: "variables", label: "Variables" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveToolbarTab(tab.key)}
              className={`px-3 py-2.5 text-[13px] font-medium transition-colors relative ${
                activeToolbarTab === tab.key
                  ? "text-fg"
                  : "text-fg-4 hover:text-fg-2"
              }`}
            >
              {tab.label}
              {activeToolbarTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Toolbar content */}
        <div className="px-4 py-2 min-h-[44px]">
          {activeToolbarTab === "text" && (
            <div className="flex items-center gap-1">
              {[
                { title: "Bold", icon: "B", style: "font-bold" },
                { title: "Italic", icon: "I", style: "italic" },
                { title: "Underline", icon: "U", style: "underline" },
                {
                  title: "Strikethrough",
                  icon: "S",
                  style: "line-through",
                },
                { title: "Code", icon: "</>", style: "font-mono text-[11px]" },
                { title: "Uppercase", icon: "AA", style: "text-[11px]" },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  <span className={btn.style}>{btn.icon}</span>
                </button>
              ))}

              <span className="w-px h-5 bg-white/10 mx-1" />

              {/* Alignment */}
              {[
                { title: "Align left", icon: "≡" },
                { title: "Align center", icon: "≡" },
                { title: "Align right", icon: "≡" },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  {btn.icon}
                </button>
              ))}

              <span className="w-px h-5 bg-white/10 mx-1" />

              {/* Lists */}
              {[
                { title: "Bullet list", icon: "•" },
                { title: "Numbered list", icon: "1." },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          )}

          {activeToolbarTab === "image" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 px-3 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
              >
                Upload image
              </button>
              <span className="text-[12px] text-fg-4">or drag and drop</span>
            </div>
          )}

          {activeToolbarTab === "components" && (
            <div className="flex items-center gap-1 flex-wrap">
              {COMPONENT_ITEMS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => insertBlock(item.type)}
                  className="h-8 px-3 text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg rounded transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[11px] font-mono">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {activeToolbarTab === "variables" && (
            <div className="flex items-center gap-1 flex-wrap">
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => {
                    const newBlock: EditorBlock = {
                      id: crypto.randomUUID(),
                      type: "variable",
                      content: v.value,
                    };
                    setBlocks((prev) => [...prev, newBlock]);
                  }}
                  className="h-8 px-2.5 text-[12px] font-mono text-fg-2 hover:bg-white/[0.08] hover:text-fg rounded border border-line transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders a single editor block by type */
function BlockRenderer({
  block,
  onUpdate,
}: {
  block: EditorBlock;
  onUpdate: (content: string) => void;
}) {
  switch (block.type) {
    case "title":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent border-none outline-none text-[28px] font-bold text-fg placeholder-[#444]"
        />
      );
    case "subtitle":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Subtitle"
          className="w-full bg-transparent border-none outline-none text-[20px] font-semibold text-fg-2 placeholder-[#444]"
        />
      );
    case "heading":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Heading"
          className="w-full bg-transparent border-none outline-none text-[18px] font-semibold text-fg placeholder-[#444]"
        />
      );
    case "quote":
      return (
        <div className="border-l-2 border-[#A1A4A5] pl-4">
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="Quote"
            rows={2}
            className="w-full bg-transparent border-none outline-none text-[14px] italic text-fg-2 placeholder-[#444] resize-none"
          />
        </div>
      );
    case "code_block":
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Code"
          rows={4}
          className="w-full bg-white/[0.03] border border-line rounded-md p-3 font-mono text-[13px] text-fg placeholder-[#444] resize-none outline-none"
        />
      );
    case "bullet_list":
      return (
        <div className="flex items-start gap-2">
          <span className="text-fg-2 mt-0.5">&#8226;</span>
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="List item"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444]"
          />
        </div>
      );
    case "numbered_list":
      return (
        <div className="flex items-start gap-2">
          <span className="text-fg-2 mt-0.5">1.</span>
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="List item"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444]"
          />
        </div>
      );
    case "image":
      return (
        <div className="border border-dashed border-line-2 rounded-lg p-8 text-center">
          <p className="text-[13px] text-fg-4">
            Click to upload or drag and drop an image
          </p>
        </div>
      );
    case "youtube":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Paste YouTube URL..."
          className="w-full bg-white/[0.03] border border-line rounded-md px-3 py-2 text-[13px] text-fg placeholder-[#444] outline-none"
        />
      );
    case "twitter":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Paste X/Twitter URL..."
          className="w-full bg-white/[0.03] border border-line rounded-md px-3 py-2 text-[13px] text-fg placeholder-[#444] outline-none"
        />
      );
    case "button":
      return (
        <div className="flex justify-center">
          <input
            type="text"
            value={block.content || "Button"}
            onChange={(e) => onUpdate(e.target.value)}
            className="bg-white text-black px-6 py-2 rounded-md text-[14px] font-medium text-center border-none outline-none min-w-[120px]"
          />
        </div>
      );
    case "divider":
      return <hr className="border-t border-line-2 my-2" />;
    case "section":
      return (
        <div className="border border-line rounded-lg p-4 min-h-[60px]">
          <p className="text-[12px] text-fg-4">Section block</p>
        </div>
      );
    case "columns":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-line rounded-lg p-3 min-h-[60px]">
            <p className="text-[12px] text-fg-4">Column 1</p>
          </div>
          <div className="border border-line rounded-lg p-3 min-h-[60px]">
            <p className="text-[12px] text-fg-4">Column 2</p>
          </div>
        </div>
      );
    case "social_links":
      return (
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-[13px] text-fg-2">Social Links</span>
        </div>
      );
    case "unsubscribe_footer":
      return (
        <div className="text-center py-3 text-[12px] text-fg-4">
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" className="underline">
            Unsubscribe
          </a>
        </div>
      );
    case "html":
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="<html>...</html>"
          rows={6}
          className="w-full bg-white/[0.03] border border-line rounded-md p-3 font-mono text-[13px] text-fg placeholder-[#444] resize-none outline-none"
        />
      );
    case "variable":
      return (
        <span className="inline-block px-2 py-1 bg-white/[0.08] rounded text-[13px] font-mono text-fg-2 border border-line">
          {block.content}
        </span>
      );
    default:
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Type something..."
          rows={2}
          className="w-full bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444] resize-none"
        />
      );
  }
}
