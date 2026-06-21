import { LandingPage } from "@/components/landing/landing-page";
import { getOpenSendGithubStars } from "@/lib/github-stars";
import { SITE_URL, SOCIAL_PREVIEW_IMAGE } from "@/lib/site-metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenSend — Open-source email API you can self-host",
  description:
    "OpenSend is an open-source, self-hostable email platform with a Resend-compatible API, a TypeScript SDK, broadcasts, contacts, and a full dashboard. Run it on your own AWS SES quota, or use the hosted version.",
  openGraph: {
    title: "OpenSend — Open-source email API you can self-host",
    description:
      "Open-source, ELv2 email platform with a Resend-compatible API, SDK, dashboard, domain verification, and webhooks. Self-host on your own AWS SES, or use the hosted version.",
    type: "website",
    url: SITE_URL,
    siteName: "OpenSend",
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSend — Open-source email API you can self-host",
    description:
      "Open-source, ELv2 email platform with a Resend-compatible API, SDK, and dashboard.",
    images: [SOCIAL_PREVIEW_IMAGE.url],
  },
  alternates: {
    canonical: `${SITE_URL}/`,
  },
};

export default async function LandingRoute() {
  const githubStars = await getOpenSendGithubStars();

  return <LandingPage githubStars={githubStars} />;
}
