"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useCallback, useEffect, useRef, useState } from "react";

const PROPERTY_TYPES = ["string", "number", "boolean", "date"] as const;

type PropertyType = (typeof PROPERTY_TYPES)[number];

function isPropertyType(value: unknown): value is PropertyType {
  return (
    typeof value === "string" &&
    PROPERTY_TYPES.some((propertyType) => propertyType === value)
  );
}

function labelForPropertyType(type: PropertyType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface Property {
  id: string;
  name: string;
  type: PropertyType;
  fallbackValue: string | null;
  createdAt: string;
  updatedAt?: string;
}

type PropertyApiPayload = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  fallback_value?: unknown;
  fallbackValue?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
};

function normalizeProperty(property: PropertyApiPayload): Property {
  const type = isPropertyType(property.type) ? property.type : "string";
  const fallback = property.fallback_value ?? property.fallbackValue ?? null;
  const createdAt =
    typeof property.created_at === "string"
      ? property.created_at
      : typeof property.createdAt === "string"
        ? property.createdAt
        : new Date(0).toISOString();
  const updatedAt =
    typeof property.updated_at === "string"
      ? property.updated_at
      : typeof property.updatedAt === "string"
        ? property.updatedAt
        : undefined;

  return {
    id: String(property.id ?? ""),
    name: String(property.name ?? ""),
    type,
    fallbackValue: fallback === null ? null : String(fallback),
    createdAt,
    updatedAt,
  };
}

export function PropertiesList() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/properties?${params.toString()}`);
      const data = (await res.json()) as {
        data?: PropertyApiPayload[];
        total?: number;
      };
      setProperties((data.data ?? []).map(normalizeProperty));
      setTotal(data.total || 0);
    } catch {
      setProperties([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const allSelected =
    properties.length > 0 && selectedIds.size === properties.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(properties.map((p) => p.id)));
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
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer appearance-none pr-8"
          style={selectStyle}
        >
          <option value="">All Types</option>
          {PROPERTY_TYPES.map((propertyType) => (
            <option key={propertyType} value={propertyType}>
              {labelForPropertyType(propertyType)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          Add property
        </button>
      </div>

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-fg mb-2">
            No properties
          </h3>
          <p className="text-[14px] text-fg-2 text-center max-w-[360px] mb-6">
            Properties let you store custom data about your contacts.
          </p>
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
                  Type
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Fallback value
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Created
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {properties.map((prop) => (
                <tr
                  key={prop.id}
                  className="border-b border-line hover:bg-bg-2 transition-colors group"
                >
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(prop.id)}
                      onChange={() => toggleRow(prop.id)}
                      className="accent-white rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg font-mono">
                    {prop.name}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {prop.type}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {prop.fallbackValue ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-fg-2"
                    title={new Date(prop.createdAt).toLocaleString()}
                  >
                    {formatRelativeTime(prop.createdAt)}
                  </td>
                  <td className="w-10 px-3 py-2 relative">
                    <RowActionsMenu
                      deleteAction={{
                        label: "Delete property",
                        confirmText: `Permanently delete the property "${prop.name}"? Stored values on contacts are not removed.`,
                        onConfirm: async () => {
                          const res = await fetch(
                            `/api/properties/${prop.id}`,
                            {
                              method: "DELETE",
                            },
                          );
                          if (!res.ok) {
                            const body = (await res
                              .json()
                              .catch(() => ({}))) as { error?: string };
                            throw new Error(
                              body.error ?? `Server error ${res.status}`,
                            );
                          }
                          fetchProperties();
                        },
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-[13px] text-fg-2">
            <span>
              Page {page} – {start} of {total} properties – {limit} items
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

      {/* Add Property Modal */}
      {showModal && (
        <AddPropertyModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchProperties();
          }}
        />
      )}
    </div>
  );
}

function AddPropertyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("string");
  const [fallbackValue, setFallbackValue] = useState("");
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
      const res = await fetch("/api/properties", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          type,
          fallbackValue: fallbackValue.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create property");
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create property");
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
          Add a new property
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="prop-name"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Name
            </label>
            <input
              id="prop-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g., company_name"
              className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
            />
          </div>

          <div>
            <label
              htmlFor="prop-type"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Type
            </label>
            <select
              id="prop-type"
              value={type}
              onChange={(e) => {
                if (isPropertyType(e.target.value)) setType(e.target.value);
              }}
              className="w-full h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer"
            >
              {PROPERTY_TYPES.map((propertyType) => (
                <option key={propertyType} value={propertyType}>
                  {labelForPropertyType(propertyType)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="prop-fallback"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Fallback Value
            </label>
            <input
              id="prop-fallback"
              type="text"
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              placeholder="Value to use when property is empty"
              className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
            />
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
            className="btn btn-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
