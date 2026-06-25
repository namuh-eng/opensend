import type {
  EditableTopic,
  PropertyRow,
  SegmentOption,
} from "@/components/contact-edit-data";
import { Plus, Trash2, X } from "lucide-react";
import type { RefObject } from "react";

type IdentitySectionProps = {
  readonly emailInputRef: RefObject<HTMLInputElement | null>;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly subscribed: boolean;
  readonly setEmail: (value: string) => void;
  readonly setFirstName: (value: string) => void;
  readonly setLastName: (value: string) => void;
  readonly setSubscribed: (value: boolean) => void;
};

type SegmentsSectionProps = {
  readonly selectedSegments: readonly SegmentOption[];
  readonly filteredSegments: readonly SegmentOption[];
  readonly segmentSearch: string;
  readonly loadingLists: boolean;
  readonly setSegmentSearch: (value: string) => void;
  readonly addSegment: (segment: SegmentOption) => void;
  readonly removeSegment: (id: string) => void;
};

type TopicsSectionProps = {
  readonly topics: readonly EditableTopic[];
  readonly setTopicSubscription: (
    id: string,
    subscription: EditableTopic["subscription"],
  ) => void;
};

type PropertiesSectionProps = {
  readonly properties: readonly PropertyRow[];
  readonly addProperty: () => void;
  readonly removeProperty: (rowId: string) => void;
  readonly updateProperty: (
    rowId: string,
    field: "key" | "value",
    value: string,
  ) => void;
};

export function IdentitySection({
  emailInputRef,
  email,
  firstName,
  lastName,
  subscribed,
  setEmail,
  setFirstName,
  setLastName,
  setSubscribed,
}: IdentitySectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <label
          htmlFor="edit-contact-email"
          className="mb-1.5 block font-medium text-[13px] text-fg"
        >
          Email
        </label>
        <input
          ref={emailInputRef}
          id="edit-contact-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-9 w-full rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
        />
      </div>
      <label className="flex items-center justify-between rounded-md border border-line bg-bg-2 px-3 py-2 text-[13px] text-fg">
        <span>Subscribed</span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Subscribed"
          aria-checked={subscribed}
          checked={subscribed}
          onChange={(event) => setSubscribed(event.target.checked)}
          className="h-4 w-8 cursor-pointer accent-white"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="edit-contact-first"
            className="mb-1.5 block font-medium text-[13px] text-fg"
          >
            First name
          </label>
          <input
            id="edit-contact-first"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-9 w-full rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
          />
        </div>
        <div>
          <label
            htmlFor="edit-contact-last"
            className="mb-1.5 block font-medium text-[13px] text-fg"
          >
            Last name
          </label>
          <input
            id="edit-contact-last"
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-9 w-full rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
          />
        </div>
      </div>
    </section>
  );
}

export function SegmentsSection({
  selectedSegments,
  filteredSegments,
  segmentSearch,
  loadingLists,
  setSegmentSearch,
  addSegment,
  removeSegment,
}: SegmentsSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium text-[13px] text-fg">Segments</h3>
      <div className="flex flex-wrap gap-1.5">
        {selectedSegments.map((segment) => (
          <span
            key={segment.id}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white/[0.08] px-2 py-0.5 text-[12px] text-fg"
          >
            {segment.name}
            <button
              type="button"
              aria-label={`Remove ${segment.name}`}
              onClick={() => removeSegment(segment.id)}
              className="text-fg-2 hover:text-fg"
            >
              <X aria-hidden="true" size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="search"
        value={segmentSearch}
        onChange={(event) => setSegmentSearch(event.target.value)}
        placeholder="Search segments"
        className="h-9 w-full rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
      />
      <div className="grid max-h-28 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {filteredSegments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => addSegment(segment)}
            className="rounded-md px-2 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {segment.name}
          </button>
        ))}
        {!loadingLists && filteredSegments.length === 0 && (
          <p className="px-2 py-1.5 text-[12px] text-fg-2">
            No segments available
          </p>
        )}
      </div>
    </section>
  );
}

export function TopicsSection({
  topics,
  setTopicSubscription,
}: TopicsSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium text-[13px] text-fg">Topics</h3>
      {topics.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {topics.map((topic) => (
            <label
              key={topic.id}
              className="flex items-center justify-between rounded-md border border-line bg-bg-2 px-3 py-2 text-[13px] text-fg"
            >
              <span>{topic.name}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={topic.name}
                aria-checked={topic.subscription === "opt_in"}
                checked={topic.subscription === "opt_in"}
                onChange={(event) =>
                  setTopicSubscription(
                    topic.id,
                    event.target.checked ? "opt_in" : "opt_out",
                  )
                }
                className="h-4 w-8 cursor-pointer accent-white"
              />
            </label>
          ))}
        </div>
      ) : (
        <a
          href="/audience/topics"
          className="inline-flex text-[13px] text-fg-2 underline-offset-4 hover:text-fg hover:underline"
        >
          No topics yet. Create topics to manage preferences.
        </a>
      )}
    </section>
  );
}

export function PropertiesSection({
  properties,
  addProperty,
  removeProperty,
  updateProperty,
}: PropertiesSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[13px] text-fg">Properties</h3>
        <button
          type="button"
          onClick={addProperty}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-fg-2 hover:bg-white/10 hover:text-fg"
        >
          <Plus aria-hidden="true" size={12} />
          Add property
        </button>
      </div>
      <div className="space-y-2">
        {properties.map((row) => (
          <div key={row.rowId} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              aria-label="Property key"
              value={row.key}
              onChange={(event) =>
                updateProperty(row.rowId, "key", event.target.value)
              }
              className="h-9 rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <input
              aria-label={`${row.key || "Property"} value`}
              value={row.value}
              onChange={(event) =>
                updateProperty(row.rowId, "value", event.target.value)
              }
              className="h-9 rounded-md border border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-fg-2 focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <button
              type="button"
              aria-label={`Remove ${row.key || "property"}`}
              onClick={() => removeProperty(row.rowId)}
              className="h-9 rounded-md px-2 text-fg-2 hover:bg-white/10 hover:text-fg"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        ))}
        {properties.length === 0 && (
          <p className="text-[12px] text-fg-2">No properties</p>
        )}
      </div>
    </section>
  );
}
