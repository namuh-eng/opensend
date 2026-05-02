"use client";

import { useState } from "react";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  curl: string;
}

interface EndpointGroup {
  name: string;
  endpoints: Endpoint[];
}

const API_GROUPS: EndpointGroup[] = [
  {
    name: "Emails",
    endpoints: [
      {
        method: "POST",
        path: "/api/emails",
        description: "Send an email",
        curl: `curl -X POST https://api.opensend.com/api/emails \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "you@example.com",
    "to": "user@example.com",
    "subject": "Hello",
    "html": "<p>Hello world</p>"
  }'`,
      },
      {
        method: "GET",
        path: "/api/emails",
        description: "List all emails with pagination",
        curl: `curl https://api.opensend.com/api/emails \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "GET",
        path: "/api/emails/:id",
        description: "Retrieve a specific email by ID",
        curl: `curl https://api.opensend.com/api/emails/EMAIL_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "POST",
        path: "/api/emails/batch",
        description: "Send a batch of emails",
        curl: `curl -X POST https://api.opensend.com/api/emails/batch \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[
    { "from": "you@example.com", "to": "a@example.com", "subject": "Hi A", "html": "<p>A</p>" },
    { "from": "you@example.com", "to": "b@example.com", "subject": "Hi B", "html": "<p>B</p>" }
  ]'`,
      },
    ],
  },
  {
    name: "Domains",
    endpoints: [
      {
        method: "POST",
        path: "/api/domains",
        description: "Add a new domain",
        curl: `curl -X POST https://api.opensend.com/api/domains \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "mail.example.com" }'`,
      },
      {
        method: "GET",
        path: "/api/domains",
        description: "List all domains",
        curl: `curl https://api.opensend.com/api/domains \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "GET",
        path: "/api/domains/:id",
        description: "Retrieve a domain by ID",
        curl: `curl https://api.opensend.com/api/domains/DOMAIN_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "DELETE",
        path: "/api/domains/:id",
        description: "Delete a domain",
        curl: `curl -X DELETE https://api.opensend.com/api/domains/DOMAIN_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "POST",
        path: "/api/domains/:id/auto-configure",
        description: "Auto-configure DNS records for a domain",
        curl: `curl -X POST https://api.opensend.com/api/domains/DOMAIN_ID/auto-configure \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "API Keys",
    endpoints: [
      {
        method: "POST",
        path: "/api/api-keys",
        description: "Create a new API key",
        curl: `curl -X POST https://api.opensend.com/api/api-keys \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Production Key" }'`,
      },
      {
        method: "GET",
        path: "/api/api-keys",
        description: "List all API keys",
        curl: `curl https://api.opensend.com/api/api-keys \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "DELETE",
        path: "/api/api-keys/:id",
        description: "Delete an API key",
        curl: `curl -X DELETE https://api.opensend.com/api/api-keys/KEY_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Templates",
    endpoints: [
      {
        method: "POST",
        path: "/api/templates",
        description: "Create a new template",
        curl: `curl -X POST https://api.opensend.com/api/templates \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Welcome Email", "html": "<p>Welcome {{name}}</p>" }'`,
      },
      {
        method: "GET",
        path: "/api/templates",
        description: "List all templates",
        curl: `curl https://api.opensend.com/api/templates \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "GET",
        path: "/api/templates/:id",
        description: "Retrieve a template by ID",
        curl: `curl https://api.opensend.com/api/templates/TEMPLATE_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "PATCH",
        path: "/api/templates/:id",
        description: "Update a template",
        curl: `curl -X PATCH https://api.opensend.com/api/templates/TEMPLATE_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Updated Template" }'`,
      },
      {
        method: "DELETE",
        path: "/api/templates/:id",
        description: "Delete a template",
        curl: `curl -X DELETE https://api.opensend.com/api/templates/TEMPLATE_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Contacts",
    endpoints: [
      {
        method: "POST",
        path: "/api/contacts",
        description: "Create a new contact",
        curl: `curl -X POST https://api.opensend.com/api/contacts \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "user@example.com", "first_name": "Jane" }'`,
      },
      {
        method: "GET",
        path: "/api/contacts",
        description: "List all contacts",
        curl: `curl https://api.opensend.com/api/contacts \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Broadcasts",
    endpoints: [
      {
        method: "POST",
        path: "/api/broadcasts",
        description: "Create a new broadcast",
        curl: `curl -X POST https://api.opensend.com/api/broadcasts \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "March Newsletter" }'`,
      },
      {
        method: "GET",
        path: "/api/broadcasts",
        description: "List all broadcasts",
        curl: `curl https://api.opensend.com/api/broadcasts \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
      {
        method: "GET",
        path: "/api/broadcasts/:id",
        description: "Retrieve a broadcast by ID",
        curl: `curl https://api.opensend.com/api/broadcasts/BROADCAST_ID \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Segments",
    endpoints: [
      {
        method: "POST",
        path: "/api/segments",
        description: "Create a new segment",
        curl: `curl -X POST https://api.opensend.com/api/segments \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Active Users" }'`,
      },
      {
        method: "GET",
        path: "/api/segments",
        description: "List all segments",
        curl: `curl https://api.opensend.com/api/segments \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Topics",
    endpoints: [
      {
        method: "POST",
        path: "/api/topics",
        description: "Create a new topic",
        curl: `curl -X POST https://api.opensend.com/api/topics \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Product Updates" }'`,
      },
      {
        method: "GET",
        path: "/api/topics",
        description: "List all topics",
        curl: `curl https://api.opensend.com/api/topics \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
  {
    name: "Properties",
    endpoints: [
      {
        method: "POST",
        path: "/api/properties",
        description: "Create a new property",
        curl: `curl -X POST https://api.opensend.com/api/properties \\
  -H "Authorization: Bearer re_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "plan", "type": "string" }'`,
      },
      {
        method: "GET",
        path: "/api/properties",
        description: "List all properties",
        curl: `curl https://api.opensend.com/api/properties \\
  -H "Authorization: Bearer re_YOUR_API_KEY"`,
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-blue-400 bg-blue-400/10",
  POST: "text-green-400 bg-green-400/10",
  PATCH: "text-yellow-400 bg-yellow-400/10",
  DELETE: "text-red-400 bg-red-400/10",
};

function EndpointCard({
  endpoint,
  expanded,
  onToggle,
}: {
  endpoint: Endpoint;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[rgba(176,199,217,0.145)] last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(24,25,28,0.5)] transition-colors"
        onClick={onToggle}
      >
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider w-16 justify-center ${METHOD_COLORS[endpoint.method] || ""}`}
        >
          {endpoint.method}
        </span>
        <span className="text-[14px] text-[#F0F0F0] font-mono flex-1">
          {endpoint.path}
        </span>
        <span className="text-[13px] text-[#A1A4A5]">
          {endpoint.description}
        </span>
        <span className="text-[#A1A4A5] text-[13px] ml-2">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pl-[92px]">
          <pre className="text-[12px] text-[#A1A4A5] font-mono bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
            {endpoint.curl}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function toggleEndpoint(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-[#F0F0F0] mb-2">
            API Reference
          </h1>
          <p className="text-[14px] text-[#A1A4A5]">
            All endpoints require a Bearer token in the Authorization header.
            Base URL:{" "}
            <code className="px-1.5 py-0.5 bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded text-[13px] text-[#F0F0F0] font-mono">
              https://api.opensend.com
            </code>
          </p>
        </div>

        {/* Groups */}
        {API_GROUPS.map((group) => (
          <div key={group.name} className="mb-8">
            <h2 className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-3">
              {group.name.toUpperCase()}
            </h2>
            <div className="border border-[rgba(176,199,217,0.145)] rounded-lg overflow-hidden">
              {group.endpoints.map((ep) => {
                const key = `${ep.method}-${ep.path}`;
                return (
                  <EndpointCard
                    key={key}
                    endpoint={ep}
                    expanded={expandedKeys.has(key)}
                    onToggle={() => toggleEndpoint(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
