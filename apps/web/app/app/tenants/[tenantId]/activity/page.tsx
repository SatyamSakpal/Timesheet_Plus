import { redirect } from "next/navigation";
import { tenantRoutes } from "@/lib/tenant-routes";

export default function TenantActivityIndexPage({
  params
}: {
  params: { tenantId: string };
}) {
  redirect(tenantRoutes.activityNew(params.tenantId));
}

