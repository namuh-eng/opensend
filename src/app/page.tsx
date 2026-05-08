import { LandingPage } from "@/components/landing/landing-page";
import { getServerSession } from "@/lib/api-auth";
import { shouldRedirectRootToDashboard } from "@/lib/root-route";
import { redirect } from "next/navigation";
import { metadata } from "./landing/page";

export { metadata };

export default async function Home() {
  const session = await getServerSession();

  if (shouldRedirectRootToDashboard(session)) {
    redirect("/emails");
  }

  return <LandingPage />;
}
