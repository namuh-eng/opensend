"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const UNSUBSCRIBE_EDITOR_UNAVAILABLE_COPY =
  "Editor unavailable; the default unsubscribe page remains active.";

interface Topic {
  id: string;
  name: string;
  description: string | null;
  defaultSubscription: "opt_in" | "opt_out";
  visibility: "private" | "public";
  createdAt: string;
}

export function TopicsList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [defaultFilter, setDefaultFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (defaultFilter) params.set("default", defaultFilter);

      const res = await fetch(`/api/topics?${params.toString()}`);
      const data = await res.json();
      setTopics(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setTopics([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, defaultFilter]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const allSelected = topics.length > 0 && selectedIds.size === topics.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(topics.map((t) => t.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalPages = Math.ceil(total / limit);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;

  const selectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search..."
          className="flex-1 h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <select
          value={defaultFilter}
          onChange={(e) => {
            setDefaultFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer appearance-none pr-8"
          style={selectStyle}
        >
          <option value="">Any Default</option>
          <option value="opt_in">Opt-in</option>
          <option value="opt_out">Opt-out</option>
        </select>

        <UnsubscribeEditorUnavailableControl label="Edit Unsubscribe Page" />

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-white/[0.12] transition-colors"
        >
          Create topic
        </button>
      </div>

      {/* Data table or empty state */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading topics...
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-fg mb-2">
            No topics yet
          </h3>
          <p className="text-[14px] text-fg-2 text-center max-w-[360px] mb-6">
            Topics let contacts manage their subscription preferences. Create
            topics to allow users to opt in or out of different types of
            communications.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn btn-primary"
            >
              Create topic
            </button>
            <UnsubscribeEditorUnavailableControl
              label="Customize page"
              align="center"
            />
          </div>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-white rounded cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Description
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Default
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Visibility
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Created
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr
                  key={topic.id}
                  className="border-b border-line hover:bg-bg-2 transition-colors group"
                >
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(topic.id)}
                      onChange={() => toggleRow(topic.id)}
                      className="accent-white rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg">
                    {topic.name}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2 max-w-[200px] truncate">
                    {topic.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {topic.defaultSubscription === "opt_in"
                      ? "Opt-in"
                      : "Opt-out"}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {topic.visibility === "public" ? "Public" : "Private"}
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-fg-2"
                    title={new Date(topic.createdAt).toLocaleString()}
                  >
                    {formatRelativeTime(topic.createdAt)}
                  </td>
                  <td className="w-10 px-3 py-2 relative">
                    <button
                      type="button"
                      aria-label="More actions"
                      className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-[13px] text-fg-2">
            <span>
              Page {page} – {start} of {total} topics – {limit} items
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                &larr;
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                &rarr;
              </button>
            </div>
          </div>
        </>
      )}

      {/* Unsubscribe Page Preview */}
      <div className="mt-8 border border-line rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-[14px] font-medium text-fg">
            Unsubscribe Page Preview
          </h3>
          <UnsubscribeEditorUnavailableControl
            label="Customize page"
            align="right"
          />
        </div>
        <div className="bg-white rounded-b-lg p-8">
          <div className="max-w-[400px] mx-auto text-center">
            <h2 className="text-[20px] font-semibold text-fg mb-2">
              Subscription Preferences
            </h2>
            <p className="text-[14px] text-fg-2 mb-6">
              Manage your email subscription preferences below.
            </p>
            <div className="space-y-3 text-left">
              {topics.length > 0 ? (
                topics
                  .filter((t) => t.visibility === "public")
                  .map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-3 p-3 border border-line-2 rounded-lg cursor-pointer hover:bg-white/[0.04]"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={t.defaultSubscription === "opt_out"}
                        className="mt-0.5 accent-black"
                        disabled
                      />
                      <div>
                        <div className="text-[14px] font-medium text-fg">
                          {t.name}
                        </div>
                        {t.description && (
                          <div className="text-[13px] text-fg-3 mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </div>
                    </label>
                  ))
              ) : (
                <div className="text-center text-[14px] text-fg-3 py-4">
                  No public topics to display
                </div>
              )}
            </div>
            <button
              type="button"
              className="mt-6 px-6 py-2 bg-black text-white text-[14px] font-medium rounded-md"
              disabled
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* Create Topic Modal */}
      {showModal && (
        <CreateTopicModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchTopics();
          }}
        />
      )}
    </div>
  );
}

function UnsubscribeEditorUnavailableControl({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "center" | "right";
}) {
  const copyId = useId();
  const alignmentClass =
    align === "right"
      ? "items-end text-right"
      : align === "center"
        ? "items-center text-center"
        : "items-start text-left";

  return (
    <div className={`flex max-w-[230px] flex-col gap-1 ${alignmentClass}`}>
      <button
        type="button"
        disabled
        aria-describedby={copyId}
        title={UNSUBSCRIBE_EDITOR_UNAVAILABLE_COPY}
        className="inline-flex cursor-not-allowed items-center rounded-md border border-line px-4 py-2 text-[13px] font-medium text-fg-4 opacity-80"
      >
        {label}
      </button>
      <p id={copyId} className="text-[11px] leading-4 text-fg-3">
        {UNSUBSCRIBE_EDITOR_UNAVAILABLE_COPY}
      </p>
    </div>
  );
}

function CreateTopicModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultSubscription, setDefaultSubscription] = useState<
    "opt_in" | "opt_out"
  >("opt_out");
  const [visibility, setVisibility] = useState<"private" | "public">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/topics", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          defaultSubscription,
          visibility,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create topic");
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create topic");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="presentation"
      />
      <div className="relative bg-bg-card border border-line rounded-lg w-[440px] p-6">
        <h2 className="text-[16px] font-semibold text-fg mb-4">
          Create a new topic
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="topic-name"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Name
            </label>
            <input
              id="topic-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="Public display name"
              className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
            />
          </div>

          <div>
            <label
              htmlFor="topic-description"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Description
            </label>
            <textarea
              id="topic-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Optional public description"
              rows={3}
              className="w-full px-3 py-2 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 resize-none"
            />
          </div>

          <div>
            <label
              htmlFor="topic-default"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Defaults to
            </label>
            <select
              id="topic-default"
              value={defaultSubscription}
              onChange={(e) =>
                setDefaultSubscription(e.target.value as "opt_in" | "opt_out")
              }
              className="w-full h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer"
            >
              <option value="opt_out">Opt-out</option>
              <option value="opt_in">Opt-in</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="topic-visibility"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Visibility
            </label>
            <select
              id="topic-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as "private" | "public")
              }
              className="w-full h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          {error && <p className="text-[13px] text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-white/[0.12] transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
