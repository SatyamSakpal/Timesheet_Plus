import { PERMISSIONS } from "@/lib/constants";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TenantMembership } from "@/lib/types";

export function resolveTenantPortalRoute(
  membership: TenantMembership,
  permissions: Set<string>
): string {
  const tenantId = membership.tenantId;

  if (membership.isOwner) {
    return tenantRoutes.ownerDashboard(tenantId);
  }

  // HOD dashboard shares the same route as owner dashboard.
  if (permissions.has(PERMISSIONS.activityApprove) || permissions.has(PERMISSIONS.reportView)) {
    return tenantRoutes.ownerDashboard(tenantId);
  }

  return tenantRoutes.activityMine(tenantId);
}
