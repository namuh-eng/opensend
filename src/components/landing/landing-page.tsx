import { type GithubStars, OPENSEND_GITHUB_REPO_URL } from "@/lib/github-stars";
import Image from "next/image";
import Link from "next/link";

const GITHUB_URL = OPENSEND_GITHUB_REPO_URL;
const GITHUB_CTA_LABEL = "Star on GitHub";
const DOCS_URL = "/docs";
const HOSTED_SIGNIN_URL = "/auth";
const SELF_HOST_URL = `${GITHUB_URL}#self-host`;

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: "Resend-compatible API",
    body: "Drop-in REST API for transactional and broadcast email. Move existing integrations over without rewriting payloads.",
  },
  {
    title: "TypeScript SDK",
    body: "Use the `opensend` package with typed request payloads, idempotency keys, and familiar developer ergonomics.",
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

const COMPARISON_ROWS: Array<{
  feature: string;
  opensend: string;
  resend: string;
  postmark: string;
}> = [
  {
    feature: "Deployment model",
    opensend: "Self-host or hosted",
    resend: "Hosted",
    postmark: "Hosted",
  },
  {
    feature: "Source availability",
    opensend: "Open source under ELv2",
    resend: "Closed source service",
    postmark: "Closed source service",
  },
  {
    feature: "Sending infrastructure",
    opensend: "Your AWS SES account or hosted OpenSend",
    resend: "Vendor-managed sending",
    postmark: "Vendor-managed sending",
  },
  {
    feature: "API and SDK",
    opensend: "Resend-compatible REST API + TypeScript SDK",
    resend: "REST API + SDKs",
    postmark: "REST API + SDKs",
  },
  {
    feature: "Self-host price floor",
    opensend: "App is self-hostable; pay your infrastructure and SES costs",
    resend: "Hosted subscription and usage pricing",
    postmark: "Hosted subscription and usage pricing",
  },
];

const PRICING_CARDS: Array<{ title: string; price: string; body: string }> = [
  {
    title: "Self-host",
    price: "Your infra + SES",
    body: "Run Docker Compose with your Postgres, S3, Cloudflare, and AWS SES credentials.",
  },
  {
    title: "Hosted",
    price: "Managed OpenSend",
    body: "Use the same API without operating the stack yourself. Sign in to get started.",
  },
];

const FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "What does the Elastic License 2.0 allow?",
    answer:
      "OpenSend source is available under ELv2 so teams can inspect, modify, and run it for their own use. Review the license before offering it as a competing hosted service.",
  },
  {
    question: "Do I need AWS SES to self-host?",
    answer:
      "Yes. The self-hosted path is designed around your AWS SES quota, plus Postgres for data, S3 for attachments, and optional Cloudflare DNS automation.",
  },
  {
    question: "Should I self-host or use hosted OpenSend?",
    answer:
      "Self-host when you want infrastructure control and your own SES reputation. Use hosted OpenSend when you want the API and dashboard without operating the stack.",
  },
  {
    question: "Can I migrate from Resend-style payloads?",
    answer:
      "OpenSend keeps a Resend-compatible surface for core send flows, so many integrations can move over by changing the base URL and API key.",
  },
];

const SDK_SAMPLE = `import { OpenSend } from "opensend";

const opensend = new OpenSend({
  apiKey: process.env.OPENSEND_API_KEY,
  baseUrl: "https://email.your-domain.com",
});

await opensend.emails.send({
  from: "Acme <hello@acme.com>",
  to: ["dev@example.com"],
  subject: "Welcome to OpenSend",
  html: "<strong>Your self-hosted email API is ready.</strong>",
});`;

type LandingPageProps = {
  githubStars?: GithubStars | null;
};

export function LandingPage({ githubStars = null }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-black text-[#F0F0F0]">
      <header className="border-b border-[rgba(176,199,217,0.145)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
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
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[#F0F0F0]"
              data-testid="nav-github"
              rel="noreferrer noopener"
              target="_blank"
            >
              <span>{GITHUB_CTA_LABEL}</span>
              {githubStars ? (
                <span className="rounded-full border border-[rgba(176,199,217,0.145)] px-1.5 py-0.5 text-[11px] leading-none text-[#F0F0F0]">
                  {githubStars.formattedCount} stars
                </span>
              ) : null}
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
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:py-24">
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
                {GITHUB_CTA_LABEL} →
              </a>
            </div>
          </div>
          <div
            aria-label="TypeScript SDK code sample"
            className="rounded-xl border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] p-4 shadow-2xl shadow-purple-950/20"
          >
            <div className="mb-3 flex items-center justify-between text-[12px] text-[#A1A4A5]">
              <span>send-email.ts</span>
              <span>opensend</span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-black p-4 font-mono text-[12px] leading-relaxed text-[#F0F0F0]">
              <code>{SDK_SAMPLE}</code>
            </pre>
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
          aria-labelledby="dashboard-heading"
          className="border-t border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.35)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <h2
                id="dashboard-heading"
                className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
              >
                A full dashboard for production email
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[#A1A4A5]">
                Inspect messages, manage API keys, verify domains, and track
                delivery health from the same app that serves your API.
              </p>
            </div>
            <div className="mt-10 overflow-hidden rounded-xl border border-[rgba(176,199,217,0.145)] bg-black">
              <Image
                src="/landing/screenshot-dashboard.png"
                alt="OpenSend dashboard showing email sending activity"
                width={3456}
                height={2184}
                priority
                sizes="(min-width: 1152px) 1104px, calc(100vw - 48px)"
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="comparison-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2
              id="comparison-heading"
              className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
            >
              OpenSend vs hosted email APIs
            </h2>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[#A1A4A5]">
              Use OpenSend when source access, self-hosting, and SES ownership
              matter. Hosted providers remain strong choices when you want a
              fully managed third-party sender.
            </p>
            <div className="mt-10 overflow-x-auto rounded-lg border border-[rgba(176,199,217,0.145)]">
              <table className="min-w-full border-collapse text-left text-[13px]">
                <caption className="sr-only">
                  Comparison of OpenSend, Resend, and Postmark
                </caption>
                <thead className="bg-[rgba(24,25,28,0.88)] text-[#F0F0F0]">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Feature
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      OpenSend
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Resend
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Postmark
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(176,199,217,0.145)]">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <th
                        scope="row"
                        className="px-5 py-4 font-medium text-[#F0F0F0]"
                      >
                        {row.feature}
                      </th>
                      <td className="px-5 py-4 text-[#A1A4A5]">
                        {row.opensend}
                      </td>
                      <td className="px-5 py-4 text-[#A1A4A5]">{row.resend}</td>
                      <td className="px-5 py-4 text-[#A1A4A5]">
                        {row.postmark}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="pricing-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2
              id="pricing-heading"
              className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
            >
              Pricing that matches how you want to operate
            </h2>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[#A1A4A5]">
              Keep costs close to AWS SES when you self-host, or choose the
              hosted path when managed operations are worth more than running
              infrastructure yourself.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {PRICING_CARDS.map((card) => (
                <article
                  key={card.title}
                  className="rounded-lg border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] p-6"
                >
                  <h3 className="text-[15px] font-semibold text-[#F0F0F0]">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-[#F0F0F0]">
                    {card.price}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#A1A4A5]">
                    {card.body}
                  </p>
                </article>
              ))}
            </div>
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
          aria-labelledby="faq-heading"
          className="border-t border-[rgba(176,199,217,0.145)]"
        >
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2
              id="faq-heading"
              className="text-2xl font-semibold tracking-tight text-[#F0F0F0]"
            >
              Frequently asked questions
            </h2>
            <div className="mt-8 divide-y divide-[rgba(176,199,217,0.145)] rounded-lg border border-[rgba(176,199,217,0.145)]">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group p-5" open>
                  <summary className="cursor-pointer list-none text-[14px] font-semibold text-[#F0F0F0]">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#A1A4A5]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
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
