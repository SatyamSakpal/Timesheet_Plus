import { redirect } from "next/navigation";
import { tenantRoutes } from "@/lib/tenant-routes";

export default function TenantHodIndexPage({
  params
}: {
  params: { tenantId: string };
}) {
  redirect(tenantRoutes.hodReview(params.tenantId));
}

