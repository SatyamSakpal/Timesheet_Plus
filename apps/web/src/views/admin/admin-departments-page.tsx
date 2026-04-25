"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AddDepartmentModal } from "@/components/admin/add-department-modal";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { DepartmentEntity } from "@/lib/types";

export default function AdminDepartmentsPage() {
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const tenantId = activeTenantId ?? "";

  const canViewDepartments =
    (activeMembership?.isOwner ?? false) ||
    permissions.has(PERMISSIONS.departmentManage) ||
    permissions.has(PERMISSIONS.memberManage) ||
    permissions.has(PERMISSIONS.reportView);
  const canAddDepartment = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.departmentManage);
  const canAssignHod = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.memberManage);

  const departmentsQuery = useQuery({
    queryKey:
      canViewDepartments && Boolean(activeTenantId)
        ? queryKeys.tenantDepartments(tenantId)
        : ["tenant-departments", "blocked"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${tenantId}/departments`),
    enabled: canViewDepartments && Boolean(activeTenantId)
  });

  const sortedDepartments = useMemo(
    () => [...(departmentsQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [departmentsQuery.data]
  );

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title="Departments"
            subtitle="Open a department to view members and HOD details, and manage assignments if your role allows it."
          />
          {canAddDepartment && canAssignHod ? (
            <Button onClick={() => setIsAddModalOpen(true)}>Add Department</Button>
          ) : null}
        </div>
        {!canViewDepartments ? (
          <p className="text-sm text-[#b42318]">You do not have permission to view departments in this tenant.</p>
        ) : null}
        {canAddDepartment && !canAssignHod ? (
          <p className="text-sm text-[#64748b]">
            You can create departments, but this screen requires HOD assignment during creation, so `member.manage`
            permission is also required.
          </p>
        ) : null}
      </Card>

      {canViewDepartments ? (
        <Card>
          {departmentsQuery.isLoading ? <p className="text-sm text-brand-moss">Loading departments...</p> : null}
          {departmentsQuery.error ? (
            <p className="text-sm text-[#b42318]">
              {departmentsQuery.error instanceof Error ? departmentsQuery.error.message : "Failed to load departments."}
            </p>
          ) : null}
          {sortedDepartments.length > 0 ? (
            <ul className="space-y-2">
              {sortedDepartments.map((department) => (
                <li key={department.id}>
                  <Link
                    href={tenantRoutes.adminDepartment(tenantId, department.id)}
                    className="block rounded-lg border border-brand-mist/70 bg-white p-4 transition hover:border-brand-moss/50 hover:bg-brand-mist/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-brand-slate">{department.name}</p>
                        <p className="mt-1 text-sm text-brand-moss">{department.description || "No description"}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {!departmentsQuery.isLoading && !departmentsQuery.error && sortedDepartments.length === 0 ? (
            <p className="text-sm text-brand-moss">No departments found yet.</p>
          ) : null}
        </Card>
      ) : null}

      {canAddDepartment && canAssignHod ? (
        <AddDepartmentModal
          tenantId={tenantId}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
