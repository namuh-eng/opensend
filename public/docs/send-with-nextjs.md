# Send emails with Next.js

Call OpenSend only from Next.js server code: Route Handlers, Server Actions, background jobs, or server-only modules. Never call the SDK from Client Components because the API key would be bundled for users.

## Install

```bash
npm install opensend
```

## Environment variables

```bash
OPENSEND_API_KEY=os_your_api_key
# Optional for self-hosted deployments:
OPENSEND_BASE_URL=http://localhost:3015
```

Do not use `NEXT_PUBLIC_OPENSEND_API_KEY`.

## Route Handler example

Create `app/api/send/route.ts`:

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

type SendRequest = {
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SendRequest;

  if (!body.email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: body.email,
    subject: "Welcome",
    html: "<p>Thanks for signing up.</p>",
  });

  if (error) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  return Response.json({ id: data.id });
}
```

## Server Action example

```ts
"use server";

import { Opensend } from "opensend";

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

export async function sendInvite(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!email) return { ok: false, error: "email is required" };

  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: email,
    subject: "You are invited",
    html: "<p>Join the workspace.</p>",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}
```

## React Email templates

React Email components work well in Next.js server files. Install the optional peer dependencies:

```bash
npm install react react-dom @react-email/components
```

```tsx
import { Html, Text } from "@react-email/components";
import { Opensend } from "opensend";

function InviteEmail({ workspace }: { workspace: string }) {
  return (
    <Html>
      <Text>You were invited to {workspace}.</Text>
    </Html>
  );
}

const opensend = new Opensend(process.env.OPENSEND_API_KEY);

await opensend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: "user@example.com",
  subject: "Workspace invite",
  react: <InviteEmail workspace="Acme" />,
});
```

## Runtime guidance

Use the Node.js runtime when your route also imports Node-only libraries. The SDK itself uses `fetch`, but template rendering and some application dependencies may require Node APIs.

```ts
export const runtime = "nodejs";
```

For Edge Runtime or middleware, use the REST API with `fetch` instead of importing Node-oriented dependencies.
