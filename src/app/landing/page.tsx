import type { Metadata } from "next";
import Link from "next/link";

const GITHUB_URL = "https://github.com/namuh-eng/opensend";
const DOCS_URL = "/docs";
const HOSTED_SIGNIN_URL = "/auth";
const SELF_HOST_URL = `${GITHUB_URL}#self-host`;

export const metadata: Metadata = {
  title: "OpenSend — Open-source email API you can self-host",
  description:
    "OpenSend is an open-source, self-hostable email platform with a Resend-compatible API, a TypeScript SDK, broadcasts, contacts, and a full dashboard. Run it on your own AWS SES quota, or use the hosted version.",
  openGraph: {
    title: "OpenSend — Open-source email API you can self-host",
    description:
      "Open-source, ELv2 email platform with a Resend-compatible API, SDK, dashboard, domain verification, and webhooks. Self-host on your own AWS SES, or use the hosted version.",
    type: "website",
    url: "https://opensend.namuh.co",
    siteName: "OpenSend",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSend — Open-source email API you can self-host",
    description:
      "Open-source, ELv2 email platform with a Resend-compatible API, SDK, and dashboard.",
  },
  alternates: {
    canonical: "https://opensend.namuh.co/landing",
  },
};

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: "Resend-compatible API",
    body: "Drop-in REST API for transactional and broadcast email. Move existing integrations over without rewriting payloads.",
  },
  {
    title: "TypeScript SDK",
    body: "First-class `@opensend/sdk` package on npm with typed payloads, retries, and idempotency keys.",
  },
  {
    title: "Domain verification",
    body: "DKIM, SPF, and DMARC are auto-configured through Cloudflare. Verify domains in minutes, not hours.",
  },
  {
    title: "Contacts, segments, broadcasts",
    body: "Manage your audience, segment by properties or topics, and send broadcasts from a real dashboard.",
  },
  {
    title: "Webhooks with HMAC signing",
    body: "Svix-compatible webhook headers with HMAC signatures for delivery, opens, clicks, bounces, and complaints.",
  },
  {
    title: "Runs on your AWS SES quota",
    body: "Bring your own SES account. Your sending reputation, your data, your cost — no vendor lock-in.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-[#F0F0F0]">
      <header className="border-b border-[rgba(176,199,217,0.145)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/landing"
            className="flex items-center gap-2 text-[14px] font-semibold tracking-tight"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-600 text-[13px] font-semibold text-white">
              o
            </span>
            OpenSend
          </Link>
          <nav className="flex items-center gap-5 text-[13px] text-[#A1A4A5]">
            <Link
              href={DOCS_URL}
              className="transition-colors hover:text-[#F0F0F0]"
            >
              Docs
            </Link>
            <a
              href={GITHUB_URL}
              className="transition-colors hover:text-[#F0F0F0]"
              rel="noreferrer noopener"
              target="_blank"
            >
              GitHub
            </a>
            <Link
              href={HOSTED_SIGNIN_URL}
              data-testid="nav-sign-in"
              className="rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-gray-200"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-[12px] font-medium uppercase tracking-widest text-[#A1A4A5]">
              Open source · ELv2 · Self-hostable
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[#F0F0F0] sm:text-5xl">
              The open-source email API you can self-host.
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[#A1A4A5]">
              OpenSend is a Resend-compatible email platform with a REST API,
              TypeScript SDK, broadcasts, contacts, and a full dashboard. Run it
              on your own AWS SES quota, or use the hosted version we run for
              you.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={SELF_HOST_URL}
                data-testid="cta-self-host"
                rel="noreferrer noopener"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-gray-200"
              >
                Self-host with Docker
              </a>
              <Link
                href={HOSTED_SIGNIN_URL}
                data-testid="cta-hosted"
                className="inline-flex items-center gap-2 rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-4 py-2.5 text-[14px] font-medium text-[#F0F0F0] transition-colors hover:border-[rgba(176,199,217,0.3)]"
              >
                Use the hosted version
              </Link>
              <a
                href={GITHUB_URL}
                data-testid="cta-github"
                rel="noreferrer noopener"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-medium text-[#A1A4A5] transition-colors hover:text-[#F0F0F0]"
              >
                Star on GitHub →
              </a>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2
              id="features-heading"
              className="text-[11px] font-medium uppercase tracking-widest text-[#A1A4A5]"
            >
              What's in the box
            </h2>
            <p className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-[#F0F0F0]">
              Everything you need to send production email — without the vendor
              lock-in.
            </p>
            <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[rgba(176,199,217,0.145)] bg-[rgba(176,199,217,0.145)] sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="bg-black p-6">
                  <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#A1A4A5]">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="self-host-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2
                id="self-host-heading"
                className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
              >
                Self-host in one command
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[#A1A4A5]">
                OpenSend ships as a multi-stage Dockerfile and{" "}
                <code className="rounded bg-[rgba(24,25,28,0.88)] px-1.5 py-0.5 font-mono text-[13px] text-[#F0F0F0]">
                  docker-compose.yml
                </code>{" "}
                with auto-migration. Bring your own AWS SES credentials and
                Postgres — your data stays on your infrastructure.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={SELF_HOST_URL}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-4 py-2.5 text-[14px] font-medium text-[#F0F0F0] transition-colors hover:border-[rgba(176,199,217,0.3)]"
                >
                  Self-host instructions
                </a>
                <Link
                  href={DOCS_URL}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-medium text-[#A1A4A5] transition-colors hover:text-[#F0F0F0]"
                >
                  Read the API docs →
                </Link>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] p-5 font-mono text-[13px] leading-relaxed text-[#F0F0F0]">
              <code>{`git clone https://github.com/namuh-eng/opensend
cd opensend
cp .env.example .env
docker compose up -d`}</code>
            </pre>
          </div>
        </section>

        <section
          aria-labelledby="hosted-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2
                id="hosted-heading"
                className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
              >
                Don't want to run it yourself?
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#A1A4A5]">
                Use the hosted version of OpenSend. We handle the SES
                deliverability, monitoring, and upgrades — you keep the same
                API.
              </p>
            </div>
            <Link
              href={HOSTED_SIGNIN_URL}
              data-testid="cta-hosted-bottom"
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-gray-200"
            >
              Get started with hosted
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(176,199,217,0.145)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <p className="text-[12px] text-[#A1A4A5]">
            © {new Date().getFullYear()} OpenSend · Licensed under Elastic
            License 2.0
          </p>
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-[#A1A4A5]">
            <Link href={DOCS_URL} className="hover:text-[#F0F0F0]">
              Docs
            </Link>
            <a
              href={GITHUB_URL}
              rel="noreferrer noopener"
              target="_blank"
              className="hover:text-[#F0F0F0]"
            >
              GitHub
            </a>
            <Link href={HOSTED_SIGNIN_URL} className="hover:text-[#F0F0F0]">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
