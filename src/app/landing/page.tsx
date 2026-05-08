import { LandingPage } from "@/components/landing/landing-page";
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
    canonical: "https://opensend.namuh.co/",
  },
};

export default function LandingRoute() {
  return <LandingPage />;
}
