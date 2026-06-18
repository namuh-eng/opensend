import { existsSync, readFileSync } from "node:fs";
import { Opensend } from "opensend";

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    const value = rawValue.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
    process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and set it.`);
  }
  return value;
}

loadDotEnv();

const client = new Opensend(requiredEnv("OPENSEND_API_KEY"), {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

const { data, error } = await client.emails.send(
  {
    from: requiredEnv("OPENSEND_FROM"),
    to: requiredEnv("OPENSEND_TO"),
    subject: "Hello from OpenSend npm",
    html: "<p>This email was sent with the published <code>opensend</code> npm package.</p>",
    text: "This email was sent with the published opensend npm package.",
  },
  {
    idempotencyKey: `npm-example-${Date.now()}`,
  },
);

if (error) {
  console.error("OpenSend send failed", {
    statusCode: error.statusCode,
    name: error.name,
    code: error.code,
    message: error.message,
    details: error.details,
  });
  process.exit(1);
}

console.log("OpenSend send accepted", data);
