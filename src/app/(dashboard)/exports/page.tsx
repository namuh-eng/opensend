import { ExportCenterPage } from "@/components/export-center-page";
import { getServerSession } from "@/lib/api-auth";
import { listDashboardExportJobs } from "@/lib/dashboard-export-jobs-service";
import { redirect } from "next/navigation";

export default async function ExportsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/auth");

  const jobs = await listDashboardExportJobs({ userId: session.user.id });
  return <ExportCenterPage initialJobs={jobs} />;
}
