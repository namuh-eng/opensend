"use client";

import type { ContactDetailData } from "@/components/contact-detail";
import {
  type EditableTopic,
  type PropertyRow,
  type SegmentOption,
  createPropertyRows,
  diffIds,
  extractSegments,
  extractTopics,
  reconcileSegments,
  reconcileTopics,
  rowsToProperties,
} from "@/components/contact-edit-data";
import {
  IdentitySection,
  PropertiesSection,
  SegmentsSection,
  TopicsSection,
} from "@/components/edit-contact-modal-sections";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

interface EditContactModalProps {
  readonly open: boolean;
  readonly contact: ContactDetailData;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function readErrorField(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = Reflect.get(payload, "error");
  return typeof message === "string" ? message : null;
}

async function requireOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;

  try {
    const payload: unknown = await response.json();
    throw new Error(readErrorField(payload) ?? fallback);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(fallback);
  }
}

function toEditableTopics(contact: ContactDetailData): EditableTopic[] {
  return contact.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    defaultSubscription: topic.subscription,
    subscription: topic.subscription,
  }));
}

export function EditContactModal({
  open,
  contact,
  onClose,
  onSuccess,
}: EditContactModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [subscribed, setSubscribed] = useState(true);
  const [availableSegments, setAvailableSegments] = useState<SegmentOption[]>(
    [],
  );
  const [selectedSegments, setSelectedSegments] = useState<SegmentOption[]>([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [topics, setTopics] = useState<EditableTopic[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const initialSegmentIdsRef = useRef<string[]>([]);
  const dialogTitleId = useId();

  const loadAudienceLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [segmentsResponse, topicsResponse] = await Promise.all([
        fetch("/api/segments"),
        fetch("/api/topics"),
      ]);

      if (segmentsResponse.ok) {
        const segmentPayload: unknown = await segmentsResponse.json();
        const nextSegments = extractSegments(segmentPayload);
        setAvailableSegments(nextSegments);
        setSelectedSegments((current) =>
          reconcileSegments(current, nextSegments),
        );
      }

      if (topicsResponse.ok) {
        const topicPayload: unknown = await topicsResponse.json();
        setTopics((current) =>
          reconcileTopics(current, extractTopics(topicPayload)),
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError("Could not load segments or topics.");
        return;
      }
      throw error;
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const initialSegments = contact.segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
    }));
    initialSegmentIdsRef.current = initialSegments.map((segment) => segment.id);
    setEmail(contact.email);
    setFirstName(contact.firstName ?? "");
    setLastName(contact.lastName ?? "");
    setSubscribed(contact.status === "subscribed");
    setSelectedSegments(initialSegments);
    setSegmentSearch("");
    setTopics(toEditableTopics(contact));
    setProperties(createPropertyRows(contact.properties));
    setSubmitError(null);
    queueMicrotask(() => emailInputRef.current?.focus());
    void loadAudienceLists();
  }, [open, contact, loadAudienceLists]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const filteredSegments = availableSegments.filter((segment) => {
    const search = segmentSearch.trim().toLowerCase();
    const matchesSearch =
      !search || segment.name.toLowerCase().includes(search);
    const selected = selectedSegments.some((item) => item.id === segment.id);
    return matchesSearch && !selected;
  });

  const addSegment = (segment: SegmentOption) => {
    setSelectedSegments((current) => [...current, segment]);
    setSegmentSearch("");
  };

  const removeSegment = (id: string) => {
    setSelectedSegments((current) =>
      current.filter((segment) => segment.id !== id),
    );
  };

  const updateProperty = (
    rowId: string,
    field: "key" | "value",
    value: string,
  ) => {
    setProperties((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addProperty = () => {
    setProperties((current) => [
      ...current,
      { rowId: `property-new-${Date.now()}`, key: "", value: "" },
    ]);
  };

  const removeProperty = (rowId: string) => {
    setProperties((current) => current.filter((item) => item.rowId !== rowId));
  };

  const setTopicSubscription = (
    id: string,
    subscription: EditableTopic["subscription"],
  ) => {
    setTopics((current) =>
      current.map((item) =>
        item.id === id ? { ...item, subscription } : item,
      ),
    );
  };

  const saveRelationships = async () => {
    const nextSegmentIds = selectedSegments.map((segment) => segment.id);
    const segmentDiff = diffIds(initialSegmentIdsRef.current, nextSegmentIds);

    await Promise.all([
      ...segmentDiff.added.map((segmentId) =>
        fetch(`/api/contacts/${contact.id}/segments/${segmentId}`, {
          method: "POST",
        }).then((response) =>
          requireOk(response, "Could not add contact segment."),
        ),
      ),
      ...segmentDiff.removed.map((segmentId) =>
        fetch(`/api/contacts/${contact.id}/segments/${segmentId}`, {
          method: "DELETE",
        }).then((response) =>
          requireOk(response, "Could not remove contact segment."),
        ),
      ),
    ]);

    if (topics.length === 0) return;
    const topicResponse = await fetch(`/api/contacts/${contact.id}/topics`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topics: topics.map((topic) => ({
          id: topic.id,
          subscription: topic.subscription,
        })),
      }),
    });
    await requireOk(topicResponse, "Could not save topic preferences.");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          unsubscribed: !subscribed,
          properties: rowsToProperties(properties),
        }),
      });
      await requireOk(response, "Could not save contact.");
      await saveRelationships();
      onSuccess();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not save changes.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: review requested an explicit role=dialog for this custom modal overlay. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-bg-card shadow-xl"
      >
        <div className="flex items-start justify-between border-line border-b px-6 py-4">
          <div>
            <h2
              id={dialogTitleId}
              className="font-semibold text-[16px] text-fg"
            >
              Edit contact
            </h2>
            <p className="mt-1 text-[12px] text-fg-2">
              Identity, subscription state, audience membership, and properties.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-fg-2 transition-colors hover:bg-white/[0.14] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="max-h-[calc(88dvh-132px)] space-y-5 overflow-y-auto px-6 py-4">
          <IdentitySection
            emailInputRef={emailInputRef}
            email={email}
            firstName={firstName}
            lastName={lastName}
            subscribed={subscribed}
            setEmail={setEmail}
            setFirstName={setFirstName}
            setLastName={setLastName}
            setSubscribed={setSubscribed}
          />
          <SegmentsSection
            selectedSegments={selectedSegments}
            filteredSegments={filteredSegments}
            segmentSearch={segmentSearch}
            loadingLists={loadingLists}
            setSegmentSearch={setSegmentSearch}
            addSegment={addSegment}
            removeSegment={removeSegment}
          />
          <TopicsSection
            topics={topics}
            setTopicSubscription={setTopicSubscription}
          />
          <PropertiesSection
            properties={properties}
            addProperty={addProperty}
            removeProperty={removeProperty}
            updateProperty={updateProperty}
          />

          {submitError && (
            <p className="text-[12px] text-red-400" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-line border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1.5 font-medium text-[13px] text-fg-2 transition-colors hover:border-line-3 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
