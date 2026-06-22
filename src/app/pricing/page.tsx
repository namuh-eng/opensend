import { PricingPage } from "@/components/landing/pricing-page";
import { SITE_URL, SOCIAL_PREVIEW_IMAGE } from "@/lib/site-metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — OpenSend",
  description:
    "Pay for sending, not for licenses. OpenSend is open-source under ELv2 — self-host free forever on your own AWS SES, or use the hosted version with usage-based pricing.",
  openGraph: {
    title: "Pricing — OpenSend",
    description:
      "Self-host free forever under ELv2, or use OpenSend's hosted plans. Usage-based pricing, no per-seat fees, no vendor lock-in.",
    type: "website",
    url: `${SITE_URL}/pricing`,
    siteName: "OpenSend",
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — OpenSend",
    description:
      "Self-host free forever under ELv2, or use OpenSend's hosted plans.",
    images: [SOCIAL_PREVIEW_IMAGE.url],
  },
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

export default function PricingRoute() {
  return <PricingPage />;
}
