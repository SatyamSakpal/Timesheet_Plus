import { redirect } from "next/navigation";
import { tenantRoutes } from "@/lib/tenant-routes";

export default async function TenantAdminIndexPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(tenantRoutes.adminRoles(tenantId));
}
