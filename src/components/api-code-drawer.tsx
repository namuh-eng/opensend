"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// --- Data types & exports ---

export type ApiContext =
  | "emails"
  | "domains"
  | "webhooks"
  | "api-keys"
  | "contacts"
  | "broadcasts"
  | "templates"
  | "segments"
  | "topics";

export interface ApiCodeSection {
  title: string;
  code: Record<string, string>;
}

export const LANGUAGE_TABS = [
  { value: "nodejs", label: "Node.js" },
  { value: "curl", label: "cURL" },
] as const;

const DRAWER_TITLES: Record<ApiContext, string> = {
  emails: "Sending Email API",
  domains: "Domains API",
  webhooks: "Webhooks API",
  "api-keys": "API Keys API",
  contacts: "Contacts API",
  broadcasts: "Broadcasts API",
  templates: "Templates API",
  segments: "Segments API",
  topics: "Topics API",
};

// --- Code examples per context ---

const EMAIL_SECTIONS: ApiCodeSection[] = [
  {
    title: "Send Email",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.emails.send({
  from: 'you@example.com',
  to: ['user@gmail.com'],
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
}, { idempotencyKey: 'welcome-user-123' });`,
      curl: `curl -X POST https://api.example.com/emails \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: welcome-user-123" \\
  -d '{
    "from": "you@example.com",
    "to": ["user@gmail.com"],
    "subject": "Hello World",
    "html": "<p>Congrats on sending your <strong>first email</strong>!</p>"
  }'`,
    },
  },
  {
    title: "Send Batch Emails",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.batch.send([
  {
    from: 'you@example.com',
    to: ['user1@gmail.com'],
    subject: 'Hello User 1',
    html: '<p>Hello User 1</p>',
  },
  {
    from: 'you@example.com',
    to: ['user2@gmail.com'],
    subject: 'Hello User 2',
    html: '<p>Hello User 2</p>',
  },
], { idempotencyKey: 'batch-campaign-123' });`,
      curl: `curl -X POST https://api.example.com/emails/batch \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: batch-campaign-123" \\
  -d '[
    {
      "from": "you@example.com",
      "to": ["user1@gmail.com"],
      "subject": "Hello User 1",
      "html": "<p>Hello User 1</p>"
    },
    {
      "from": "you@example.com",
      "to": ["user2@gmail.com"],
      "subject": "Hello User 2",
      "html": "<p>Hello User 2</p>"
    }
  ]'`,
    },
  },
  {
    title: "Retrieve Email",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.emails.get(
  '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'
);`,
      curl: `curl -X GET https://api.example.com/emails/49a3999c-0ce1-4ea6-ab68-afcd6dc2e794 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Update Email",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.emails.update({
  id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
  scheduledAt: '2024-08-05T11:52:01.858Z',
});`,
      curl: `curl -X PATCH https://api.example.com/emails/49a3999c-0ce1-4ea6-ab68-afcd6dc2e794 \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scheduledAt": "2024-08-05T11:52:01.858Z"
  }'`,
    },
  },
];

const DOMAIN_SECTIONS: ApiCodeSection[] = [
  {
    title: "Add Domain",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.create({
  name: 'example.com',
});`,
      curl: `curl -X POST https://api.example.com/domains \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "example.com"}'`,
    },
  },
  {
    title: "Retrieve Domain",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.get(
  'd91cd9bd-1176-453e-8fc1-35364d380206'
);`,
      curl: `curl -X GET https://api.example.com/domains/d91cd9bd-1176-453e-8fc1-35364d380206 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Verify Domain",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.verify(
  'd91cd9bd-1176-453e-8fc1-35364d380206'
);`,
      curl: `curl -X POST https://api.example.com/domains/d91cd9bd-1176-453e-8fc1-35364d380206/verify \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Update Domain",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.update({
  id: 'd91cd9bd-1176-453e-8fc1-35364d380206',
  openTracking: true,
  clickTracking: true,
});`,
      curl: `curl -X PATCH https://api.example.com/domains/d91cd9bd-1176-453e-8fc1-35364d380206 \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "openTracking": true,
    "clickTracking": true
  }'`,
    },
  },
  {
    title: "List Domains",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.list();`,
      curl: `curl -X GET https://api.example.com/domains \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Delete Domain",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.domains.remove(
  'd91cd9bd-1176-453e-8fc1-35364d380206'
);`,
      curl: `curl -X DELETE https://api.example.com/domains/d91cd9bd-1176-453e-8fc1-35364d380206 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const WEBHOOK_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Webhook",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.webhooks.create({
  endpoint: 'https://example.com/webhooks',
  events: ['email.sent', 'email.delivered', 'email.bounced'],
});`,
      curl: `curl -X POST https://api.example.com/webhooks \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "https://example.com/webhooks",
    "events": ["email.sent", "email.delivered", "email.bounced"]
  }'`,
    },
  },
  {
    title: "List Webhooks",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.webhooks.list();`,
      curl: `curl -X GET https://api.example.com/webhooks \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove Webhook",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.webhooks.remove(
  'wh_123456789'
);`,
      curl: `curl -X DELETE https://api.example.com/webhooks/wh_123456789 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const API_KEY_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create API Key",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.apiKeys.create({
  name: 'Production',
  permission: 'full_access',
});`,
      curl: `curl -X POST https://api.example.com/api-keys \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production",
    "permission": "full_access"
  }'`,
    },
  },
  {
    title: "List API Keys",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.apiKeys.list();`,
      curl: `curl -X GET https://api.example.com/api-keys \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove API Key",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.apiKeys.remove(
  'key_123456789'
);`,
      curl: `curl -X DELETE https://api.example.com/api-keys/key_123456789 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const CONTACT_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Contact",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.contacts.create({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  unsubscribed: false,
  segmentId: '78261eea-8f8b-4381-83c6-79fa7120f1cf',
});`,
      curl: `curl -X POST https://api.example.com/contacts \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "unsubscribed": false,
    "segmentId": "78261eea-8f8b-4381-83c6-79fa7120f1cf"
  }'`,
    },
  },
  {
    title: "List Contacts",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.contacts.list({
  segmentId: '78261eea-8f8b-4381-83c6-79fa7120f1cf',
});`,
      curl: `curl -X GET "https://api.example.com/contacts?segmentId=78261eea-8f8b-4381-83c6-79fa7120f1cf" \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove Contact",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.contacts.remove({
  id: '520784e2-887d-4c25-b53c-4ad46ad38100',
  segmentId: '78261eea-8f8b-4381-83c6-79fa7120f1cf',
});`,
      curl: `curl -X DELETE "https://api.example.com/contacts/520784e2-887d-4c25-b53c-4ad46ad38100?segmentId=78261eea-8f8b-4381-83c6-79fa7120f1cf" \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const BROADCAST_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Broadcast",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.broadcasts.create({
  segmentId: '78261eea-8f8b-4381-83c6-79fa7120f1cf',
  from: 'you@example.com',
  subject: 'Hello World',
  html: '<p>Hello subscribers!</p>',
});`,
      curl: `curl -X POST https://api.example.com/broadcasts \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "segmentId": "78261eea-8f8b-4381-83c6-79fa7120f1cf",
    "from": "you@example.com",
    "subject": "Hello World",
    "html": "<p>Hello subscribers!</p>"
  }'`,
    },
  },
  {
    title: "Send Broadcast",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.broadcasts.send(
  '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'
);`,
      curl: `curl -X POST https://api.example.com/broadcasts/49a3999c-0ce1-4ea6-ab68-afcd6dc2e794/send \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "List Broadcasts",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.broadcasts.list();`,
      curl: `curl -X GET https://api.example.com/broadcasts \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const TEMPLATE_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Template",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.templates.create({
  name: 'Welcome Email',
  html: '<p>Welcome {{name}}!</p>',
});`,
      curl: `curl -X POST https://api.example.com/templates \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Welcome Email",
    "html": "<p>Welcome {{name}}!</p>"
  }'`,
    },
  },
  {
    title: "List Templates",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.templates.list();`,
      curl: `curl -X GET https://api.example.com/templates \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove Template",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.templates.remove(
  'tmpl_123456789'
);`,
      curl: `curl -X DELETE https://api.example.com/templates/tmpl_123456789 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const SEGMENT_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Segment",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.segments.create({
  name: 'Newsletter Subscribers',
});`,
      curl: `curl -X POST https://api.example.com/segments \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Newsletter Subscribers"}'`,
    },
  },
  {
    title: "List Segments",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.segments.list();`,
      curl: `curl -X GET https://api.example.com/segments \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove Segment",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.segments.remove(
  '78261eea-8f8b-4381-83c6-79fa7120f1cf'
);`,
      curl: `curl -X DELETE https://api.example.com/segments/78261eea-8f8b-4381-83c6-79fa7120f1cf \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const TOPIC_SECTIONS: ApiCodeSection[] = [
  {
    title: "Create Topic",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.topics.create({
  name: 'Product Updates',
});`,
      curl: `curl -X POST https://api.example.com/topics \\
  -H "Authorization: Bearer re_123456789" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Product Updates"}'`,
    },
  },
  {
    title: "List Topics",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.topics.list();`,
      curl: `curl -X GET https://api.example.com/topics \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
  {
    title: "Remove Topic",
    code: {
      nodejs: `import { Resend } from 'resend';

const resend = new Resend('re_123456789');

const { data, error } = await resend.topics.remove(
  'topic_123456789'
);`,
      curl: `curl -X DELETE https://api.example.com/topics/topic_123456789 \\
  -H "Authorization: Bearer re_123456789"`,
    },
  },
];

const CODE_SECTIONS_MAP: Record<ApiContext, ApiCodeSection[]> = {
  emails: EMAIL_SECTIONS,
  domains: DOMAIN_SECTIONS,
  webhooks: WEBHOOK_SECTIONS,
  "api-keys": API_KEY_SECTIONS,
  contacts: CONTACT_SECTIONS,
  broadcasts: BROADCAST_SECTIONS,
  templates: TEMPLATE_SECTIONS,
  segments: SEGMENT_SECTIONS,
  topics: TOPIC_SECTIONS,
};

export function getCodeSections(context: ApiContext): ApiCodeSection[] {
  return CODE_SECTIONS_MAP[context] ?? [];
}

// --- Copy button component ---

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy code"}
      className="absolute top-2 right-2 p-1.5 rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:bg-[rgba(176,199,217,0.145)] transition-colors"
      onClick={handleCopy}
    >
      {copied ? (
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-green-400"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
        </svg>
      )}
    </button>
  );
}

// --- Drawer component ---

interface ApiCodeDrawerProps {
  open: boolean;
  onClose: () => void;
  context: ApiContext;
}

export function ApiCodeDrawer({ open, onClose, context }: ApiCodeDrawerProps) {
  const [activeLanguage, setActiveLanguage] = useState("nodejs");
  const drawerRef = useRef<HTMLDialogElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing from the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  const sections = getCodeSections(context);
  const title = DRAWER_TITLES[context] ?? "API";

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <dialog
        ref={drawerRef}
        aria-label={title}
        open={open}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[520px] m-0 p-0 bg-[#0a0a0a] border-l border-[rgba(176,199,217,0.145)] shadow-2xl transform transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(176,199,217,0.145)]">
          <h2 className="text-[16px] font-semibold text-[#F0F0F0]">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            className="p-1 rounded hover:bg-[rgba(176,199,217,0.145)] text-[#A1A4A5] hover:text-[#F0F0F0] transition-colors"
            onClick={onClose}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Language tabs */}
        <div className="flex items-center gap-0 px-6 border-b border-[rgba(176,199,217,0.145)]">
          {LANGUAGE_TABS.map((tab) => {
            const isActive = tab.value === activeLanguage;
            return (
              <button
                key={tab.value}
                type="button"
                data-testid={`lang-tab-${tab.value}`}
                className={`px-4 py-2.5 text-[13px] font-medium transition-colors relative ${
                  isActive
                    ? "text-[#F0F0F0]"
                    : "text-[#A1A4A5] hover:text-[#F0F0F0]"
                }`}
                onClick={() => setActiveLanguage(tab.value)}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F0F0F0]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Code sections */}
        <div className="overflow-y-auto h-[calc(100%-105px)] px-6 py-4 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[13px] font-medium text-[#A1A4A5] mb-2">
                {section.title}
              </h3>
              <div className="relative rounded-lg bg-[rgba(24,25,28,0.6)] border border-[rgba(176,199,217,0.1)]">
                <CopyButton code={section.code[activeLanguage] ?? ""} />
                <pre className="p-4 pr-10 overflow-x-auto text-[13px] leading-[1.6] text-[#e4e4e7] font-mono">
                  <code>{section.code[activeLanguage] ?? ""}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}

// --- Trigger button (reusable) ---

interface ApiDrawerButtonProps {
  onClick: () => void;
}

export function ApiDrawerButton({ onClick }: ApiDrawerButtonProps) {
  return (
    <button
      type="button"
      aria-label="API drawer"
      className="p-2 rounded-md border border-[rgba(176,199,217,0.145)] text-[#A1A4A5] hover:text-[#F0F0F0] hover:bg-[rgba(24,25,28,0.5)] transition-colors"
      onClick={onClick}
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
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
