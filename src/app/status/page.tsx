import { StatusPage } from "@/components/status/status-page";
import { getPublicStatusSnapshot } from "@/lib/public-status";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OpenSend Status",
  description: "Public OpenSend component status and incident history.",
  alternates: {
    canonical: "https://opensend.namuh.co/status",
  },
};

export default async function PublicStatusPage() {
  const status = await getPublicStatusSnapshot();

  return <StatusPage status={status} />;
}
