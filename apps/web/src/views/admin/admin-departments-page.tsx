"use client";

import { DepartmentManager } from "@/components/admin/department-manager";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";

export default function AdminDepartmentsPage() {
  const { activeTenantId } = useActiveTenant();
  if (!activeTenantId) {
    return <TenantRequired />;
  }
  return <DepartmentManager tenantId={activeTenantId} />;
}
