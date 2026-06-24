import { redirect } from "next/navigation";
import { DASHBOARD_FEATURE_ENABLED } from "@/lib/dashboard/feature-flag";
import { InsightsDashboard } from "@/components/dashboard/InsightsDashboard";

export default function DashboardPage() {
  if (!DASHBOARD_FEATURE_ENABLED) {
    redirect("/");
  }
  return <InsightsDashboard />;
}
