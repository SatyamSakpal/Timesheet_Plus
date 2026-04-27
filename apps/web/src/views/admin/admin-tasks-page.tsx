"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { ApiClientError } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TaskTemplate } from "@/lib/types";
import { TenantRequired } from "@/components/layout/tenant-required";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";

interface AssignedDepartmentDetail {
  id: string;
  name: string;
}

function asAssignedDepartments(details: unknown): AssignedDepartmentDetail[] {
  if (!details || typeof details !== "object") {
    return [];
  }
  const payload = details as { assignedDepartments?: unknown };
  if (!Array.isArray(payload.assignedDepartments)) {
    return [];
  }
  return payload.assignedDepartments
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as { id?: unknown; name?: unknown };
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
        return null;
      }
      return { id: candidate.id, name: candidate.name };
    })
    .filter((entry): entry is AssignedDepartmentDetail => Boolean(entry));
}

export default function AdminTasksPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const tenantId = activeTenantId ?? "";
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<TaskTemplate | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [assignedDepartments, setAssignedDepartments] = useState<AssignedDepartmentDetail[]>([]);

  const templatesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantTaskTemplates(tenantId) : ["tenant-task-templates", "none"],
    queryFn: () => apiClient.get<TaskTemplate[]>(`/v1/tenants/${tenantId}/task-templates`),
    enabled: Boolean(activeTenantId)
  });

  const canManageTemplates =
    (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.taskTemplateManage);
  const isDeleteModalOpen = Boolean(pendingDeleteTemplate);

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiClient.delete<TaskTemplate>(`/v1/tenants/${tenantId}/task-templates/${templateId}`),
    onSuccess: async () => {
      setDeleteErrorMessage(null);
      setAssignedDepartments([]);
      setPendingDeleteTemplate(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantTaskTemplates(tenantId) });
    },
    onError: (nextError) => {
      if (nextError instanceof ApiClientError) {
        setDeleteErrorMessage(nextError.message);
        setAssignedDepartments(asAssignedDepartments(nextError.details));
        return;
      }
      setDeleteErrorMessage(nextError instanceof Error ? nextError.message : "Failed to delete activity.");
      setAssignedDepartments([]);
    }
  });

  const canConfirmDelete = useMemo(
    () => assignedDepartments.length === 0 && !deleteTemplateMutation.isPending,
    [assignedDepartments.length, deleteTemplateMutation.isPending]
  );

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  function openDeleteModal(template: TaskTemplate) {
    setPendingDeleteTemplate(template);
    setDeleteErrorMessage(null);
    setAssignedDepartments([]);
  }

  function closeDeleteModal() {
    if (deleteTemplateMutation.isPending) {
      return;
    }
    setPendingDeleteTemplate(null);
    setDeleteErrorMessage(null);
    setAssignedDepartments([]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="Activities"
            subtitle="List of activity templates. Click any activity to edit form builder and department assignments."
          />
          {canManageTemplates ? (
            <Button onClick={() => router.push(tenantRoutes.activitiesNew(tenantId))}>Add Activity</Button>
          ) : null}
        </div>
      </Card>

      <Card>
        {templatesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading activities...</p> : null}
        {templatesQuery.error ? (
          <p className="text-sm text-red-700">
            {templatesQuery.error instanceof Error ? templatesQuery.error.message : "Failed to load activities."}
          </p>
        ) : null}

        {(templatesQuery.data ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-mist text-xs uppercase tracking-wide text-brand-moss">
                <tr>
                  <th className="px-2 py-2">Activity</th>
                  <th className="px-2 py-2">Version</th>
                  <th className="px-2 py-2">Fields</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(templatesQuery.data ?? []).map((template) => (
                  <tr key={template.id} className="border-b border-brand-mist/60">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-left font-semibold text-brand-slate hover:text-brand-moss hover:underline"
                        onClick={() =>
                          router.push(tenantRoutes.activitiesDetail(tenantId, template.id))
                        }
                      >
                        {template.name}
                      </button>
                    </td>
                    <td className="px-2 py-2">v{template.version}</td>
                    <td className="px-2 py-2">{template.fields.length}</td>
                    <td className="px-2 py-2">{template.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            router.push(tenantRoutes.activitiesDetail(tenantId, template.id))
                          }
                        >
                          Open
                        </Button>
                        {canManageTemplates ? (
                          <Button
                            variant="danger"
                            onClick={() => openDeleteModal(template)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !templatesQuery.isLoading && <p className="text-sm text-brand-moss">No activity templates found.</p>
        )}
      </Card>

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
                    Delete Activity
                  </h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    {pendingDeleteTemplate ? `Activity: ${pendingDeleteTemplate.name}` : "Selected activity"}
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

              {assignedDepartments.length > 0 ? (
                <div className="mt-5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-3 text-sm text-[#b42318]">
                  <p className="font-semibold">This activity cannot be deleted because it is assigned to these departments:</p>
                  <ul className="mt-2 list-disc pl-5">
                    {assignedDepartments.map((department) => (
                      <li key={department.id}>{department.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#334155]">
                  This action will permanently remove the activity template.
                </p>
              )}

              {deleteErrorMessage && assignedDepartments.length === 0 ? (
                <p className="mt-3 text-sm text-[#b42318]">{deleteErrorMessage}</p>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeDeleteModal}>
                  {assignedDepartments.length > 0 ? "Okay" : "Cancel"}
                </Button>
                {assignedDepartments.length === 0 ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!canConfirmDelete}
                    onClick={() => {
                      if (!pendingDeleteTemplate) {
                        return;
                      }
                      deleteTemplateMutation.mutate(pendingDeleteTemplate.id);
                    }}
                  >
                    {deleteTemplateMutation.isPending ? "Deleting..." : "Delete Activity"}
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
