import { PERMISSIONS } from "@/lib/constants";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TenantMembership } from "@/lib/types";

const ADMIN_PORTAL_PERMISSIONS = [
  PERMISSIONS.tenantManage,
  PERMISSIONS.departmentManage,
  PERMISSIONS.memberManage,
  PERMISSIONS.roleManage,
  PERMISSIONS.taskTemplateManage,
  PERMISSIONS.taskAssign
] as const;

export function resolveTenantPortalRoute(
  membership: TenantMembership,
  permissions: Set<string>
): string {
  const tenantId = membership.tenantId;

  if (membership.isOwner) {
    return tenantRoutes.ownerDashboard(tenantId);
  }

  if (ADMIN_PORTAL_PERMISSIONS.some((permission) => permissions.has(permission))) {
    return tenantRoutes.adminRoot(tenantId);
  }

  if (permissions.has(PERMISSIONS.activityApprove)) {
    return tenantRoutes.hodReview(tenantId);
  }

  if (permissions.has(PERMISSIONS.activityCreate)) {
    return tenantRoutes.activityNew(tenantId);
  }

  return tenantRoutes.activityMine(tenantId);
}

