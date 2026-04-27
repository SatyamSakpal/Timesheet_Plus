"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AddDepartmentModal } from "@/components/admin/add-department-modal";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";
import { TenantRequired } from "@/components/layout/tenant-required";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { ApiClientError } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { DepartmentEntity } from "@/lib/types";

interface AssignedUserDetail {
  userId: string;
  name: string;
  email: string;
  reasons: string[];
}

function asAssignedUsers(details: unknown): AssignedUserDetail[] {
  if (!details || typeof details !== "object") {
    return [];
  }
  const payload = details as { assignedUsers?: unknown };
  if (!Array.isArray(payload.assignedUsers)) {
    return [];
  }
  return payload.assignedUsers
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as {
        userId?: unknown;
        name?: unknown;
        email?: unknown;
        reasons?: unknown;
      };
      if (
        typeof candidate.userId !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.email !== "string"
      ) {
        return null;
      }
      const reasons = Array.isArray(candidate.reasons)
        ? candidate.reasons.filter((reason): reason is string => typeof reason === "string")
        : [];
      return {
        userId: candidate.userId,
        name: candidate.name,
        email: candidate.email,
        reasons
      };
    })
    .filter((entry): entry is AssignedUserDetail => Boolean(entry));
}

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingDeleteDepartment, setPendingDeleteDepartment] = useState<DepartmentEntity | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUserDetail[]>([]);
  const tenantId = activeTenantId ?? "";

  const canViewDepartments =
    (activeMembership?.isOwner ?? false) ||
    permissions.has(PERMISSIONS.departmentManage) ||
    permissions.has(PERMISSIONS.memberManage) ||
    permissions.has(PERMISSIONS.reportView);
  const canAddDepartment = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.departmentManage);
  const canDeleteDepartment = canAddDepartment;
  const canAssignHod = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.memberManage);

  const departmentsQuery = useQuery({
    queryKey:
      canViewDepartments && Boolean(activeTenantId)
        ? queryKeys.tenantDepartments(tenantId)
        : ["tenant-departments", "blocked"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${tenantId}/departments`),
    enabled: canViewDepartments && Boolean(activeTenantId)
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) =>
      apiClient.delete<DepartmentEntity>(`/v1/tenants/${tenantId}/departments/${departmentId}`),
    onSuccess: async () => {
      setDeleteErrorMessage(null);
      setAssignedUsers([]);
      setPendingDeleteDepartment(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantDepartments(tenantId) });
    },
    onError: (nextError) => {
      if (nextError instanceof ApiClientError) {
        setDeleteErrorMessage(nextError.message);
        setAssignedUsers(asAssignedUsers(nextError.details));
        return;
      }
      setDeleteErrorMessage(nextError instanceof Error ? nextError.message : "Failed to delete department.");
      setAssignedUsers([]);
    }
  });

  const sortedDepartments = useMemo(
    () => [...(departmentsQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [departmentsQuery.data]
  );
  const isDeleteModalOpen = Boolean(pendingDeleteDepartment);
  const canConfirmDelete = assignedUsers.length === 0 && !deleteDepartmentMutation.isPending;

  function openDeleteModal(department: DepartmentEntity) {
    setPendingDeleteDepartment(department);
    setDeleteErrorMessage(null);
    setAssignedUsers([]);
  }

  function closeDeleteModal() {
    if (deleteDepartmentMutation.isPending) {
      return;
    }
    setPendingDeleteDepartment(null);
    setDeleteErrorMessage(null);
    setAssignedUsers([]);
  }

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
                  <div className="rounded-lg border border-brand-mist/70 bg-white p-4 transition hover:border-brand-moss/50 hover:bg-brand-mist/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-brand-slate">{department.name}</p>
                        <p className="mt-1 text-sm text-brand-moss">{department.description || "No description"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => router.push(tenantRoutes.adminDepartment(tenantId, department.id))}
                        >
                          Open
                        </Button>
                        {canDeleteDepartment ? (
                          <Button variant="danger" onClick={() => openDeleteModal(department)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
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

      {isDeleteModalOpen ? (
        <ModalOverlay onClose={closeDeleteModal}>
          <section
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[90vh] overflow-y-auto p-6 [scrollbar-gutter:stable]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                    Delete Department
                  </h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    {pendingDeleteDepartment ? `Department: ${pendingDeleteDepartment.name}` : "Selected department"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-semibold text-[#64748b] hover:bg-[#f1f5f9]"
                  onClick={closeDeleteModal}
                >
                  Close
                </button>
              </div>

              {assignedUsers.length > 0 ? (
                <div className="mt-5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-3 text-sm text-[#b42318]">
                  <p className="font-semibold">
                    This department cannot be deleted because these users are still assigned:
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {assignedUsers.map((user) => (
                      <li key={user.userId}>
                        {user.name} ({user.email})
                        {user.reasons.length > 0 ? ` - ${user.reasons.join(", ")}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#334155]">
                  This action will permanently remove the department.
                </p>
              )}

              {deleteErrorMessage && assignedUsers.length === 0 ? (
                <p className="mt-3 text-sm text-[#b42318]">{deleteErrorMessage}</p>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeDeleteModal}>
                  {assignedUsers.length > 0 ? "Okay" : "Cancel"}
                </Button>
                {assignedUsers.length === 0 ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!canConfirmDelete}
                    onClick={() => {
                      if (!pendingDeleteDepartment) {
                        return;
                      }
                      deleteDepartmentMutation.mutate(pendingDeleteDepartment.id);
                    }}
                  >
                    {deleteDepartmentMutation.isPending ? "Deleting..." : "Delete Department"}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
