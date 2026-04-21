import { redirect } from "next/navigation";
import { tenantRoutes } from "@/lib/tenant-routes";

export default function TenantAdminIndexPage({
  params
}: {
  params: { tenantId: string };
}) {
  redirect(tenantRoutes.adminRoles(params.tenantId));
}

