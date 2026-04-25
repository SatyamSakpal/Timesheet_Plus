"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddDepartmentModal } from "@/components/admin/add-department-modal";
import { Button, Card, InlineError, SectionTitle } from "@/components/ui/primitives";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type {
  DepartmentEntity,
  DepartmentHodCompact,
  DepartmentPersonCompact,
  TaskTemplate,
  TenantMemberListItem
} from "@/lib/types";

export default function AdminDepartmentDetailPage() {
  const params = useParams<{ departmentId: string }>();
  const departmentId = params.departmentId;
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const tenantId = activeTenantId ?? "";

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [hodEmail, setHodEmail] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const canViewDepartment =
    (activeMembership?.isOwner ?? false) ||
    permissions.has(PERMISSIONS.departmentManage) ||
    permissions.has(PERMISSIONS.memberManage) ||
    permissions.has(PERMISSIONS.reportView);
  const canAddDepartment = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.departmentManage);
  const canManageMembers = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.memberManage);
  const canAssignActivities = (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.taskAssign);

  const departmentsQuery = useQuery({
    queryKey:
      canViewDepartment && Boolean(activeTenantId)
        ? queryKeys.tenantDepartments(tenantId)
        : ["tenant-departments", "blocked"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${tenantId}/departments`),
    enabled: canViewDepartment && Boolean(activeTenantId)
  });

  const department = useMemo(
    () => (departmentsQuery.data ?? []).find((entry) => entry.id === departmentId) ?? null,
    [departmentsQuery.data, departmentId]
  );

  const membersQuery = useQuery({
    queryKey:
      canViewDepartment && Boolean(activeTenantId) && departmentId
        ? queryKeys.departmentMembers(tenantId, departmentId)
        : ["department-members", "blocked"],
    queryFn: () =>
      apiClient.get<DepartmentPersonCompact[]>(`/v1/tenants/${tenantId}/departments/${departmentId}/members`),
    enabled: canViewDepartment && Boolean(activeTenantId && departmentId)
  });

  const hodsQuery = useQuery({
    queryKey:
      canViewDepartment && Boolean(activeTenantId) && departmentId
        ? queryKeys.departmentHods(tenantId, departmentId)
        : ["department-hods", "blocked"],
    queryFn: () =>
      apiClient.get<DepartmentHodCompact[]>(`/v1/tenants/${tenantId}/departments/${departmentId}/hods`),
    enabled: canViewDepartment && Boolean(activeTenantId && departmentId)
  });

  const assignedTasksQuery = useQuery({
    queryKey:
      canViewDepartment && Boolean(activeTenantId) && departmentId
        ? queryKeys.departmentTasks(tenantId, departmentId)
        : ["department-tasks", "blocked"],
    queryFn: () => apiClient.get<TaskTemplate[]>(`/v1/tenants/${tenantId}/departments/${departmentId}/tasks`),
    enabled: canViewDepartment && Boolean(activeTenantId && departmentId)
  });

  const taskTemplatesQuery = useQuery({
    queryKey:
      canAssignActivities && Boolean(activeTenantId)
        ? queryKeys.tenantTaskTemplates(tenantId)
        : ["tenant-task-templates", "blocked"],
    queryFn: () => apiClient.get<TaskTemplate[]>(`/v1/tenants/${tenantId}/task-templates`),
    enabled: canAssignActivities && Boolean(activeTenantId)
  });

  const tenantMembersQuery = useQuery({
    queryKey:
      canManageMembers && Boolean(activeTenantId)
        ? queryKeys.tenantMembers(tenantId)
        : ["tenant-members", "blocked"],
    queryFn: () => apiClient.get<TenantMemberListItem[]>(`/v1/tenants/${tenantId}/members`),
    enabled: canManageMembers && Boolean(activeTenantId)
  });

  const emailToUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of tenantMembersQuery.data ?? []) {
      if (member.status !== "active") {
        continue;
      }
      map.set(member.email.trim().toLowerCase(), member.userId);
    }
    return map;
  }, [tenantMembersQuery.data]);

  const sortedMemberEmails = useMemo(
    () => [...emailToUserId.keys()].sort((left, right) => left.localeCompare(right)),
    [emailToUserId]
  );

  const availableTemplates = useMemo(() => {
    const assignedIds = new Set((assignedTasksQuery.data ?? []).map((task) => task.id));
    return (taskTemplatesQuery.data ?? []).filter((template) => !assignedIds.has(template.id));
  }, [assignedTasksQuery.data, taskTemplatesQuery.data]);

  const assignTaskMutation = useMutation({
    mutationFn: (taskTemplateId: string) =>
      apiClient.post(`/v1/tenants/${tenantId}/departments/${departmentId}/tasks/${taskTemplateId}`),
    onSuccess: async () => {
      setActionError(null);
      setSelectedTemplateId("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.departmentTasks(tenantId, departmentId)
      });
    },
    onError: (nextError) => {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to assign activity.");
    }
  });

  const unassignTaskMutation = useMutation({
    mutationFn: (taskTemplateId: string) =>
      apiClient.delete(`/v1/tenants/${tenantId}/departments/${departmentId}/tasks/${taskTemplateId}`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.departmentTasks(tenantId, departmentId)
      });
    },
    onError: (nextError) => {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to remove assigned activity.");
    }
  });

  const assignHodMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/v1/tenants/${tenantId}/departments/${departmentId}/hods`, {
        body: { userId }
      }),
    onSuccess: async () => {
      setActionError(null);
      setHodEmail("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.departmentHods(tenantId, departmentId)
      });
    },
    onError: (nextError) => {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to assign HOD.");
    }
  });

  function onAssignHod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    const email = hodEmail.trim().toLowerCase();
    if (!email) {
      setActionError("HOD email is required.");
      return;
    }
    const userId = emailToUserId.get(email);
    if (!userId) {
      setActionError("Select a valid HOD email from tenant members.");
      return;
    }
    assignHodMutation.mutate(userId);
  }

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={tenantRoutes.adminDepartments(activeTenantId)}
              className="text-sm font-semibold text-[#1d4ed8]"
            >
              Back to departments
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
              {department?.name ?? "Department"}
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">
              {department?.description || "No description"}
            </p>
          </div>
          {canAddDepartment && canManageMembers ? (
            <Button onClick={() => setIsAddModalOpen(true)}>Add Department</Button>
          ) : null}
        </div>
        {!canViewDepartment ? (
          <p className="mt-3 text-sm text-[#b42318]">You do not have permission to view this department.</p>
        ) : null}
      </Card>

      {canViewDepartment ? (
        <>
          {!department && !departmentsQuery.isLoading ? (
            <Card>
              <p className="text-sm text-[#b42318]">Department not found or inaccessible.</p>
            </Card>
          ) : null}

          <Card>
            <SectionTitle
              title="Assigned Activities"
              subtitle="Activities are task templates assigned to this department."
            />
            {assignedTasksQuery.isLoading ? <p className="text-sm text-brand-moss">Loading assigned activities...</p> : null}
            {assignedTasksQuery.error ? (
              <p className="text-sm text-[#b42318]">
                {assignedTasksQuery.error instanceof Error ? assignedTasksQuery.error.message : "Failed to load assigned activities."}
              </p>
            ) : null}
            {(assignedTasksQuery.data ?? []).length > 0 ? (
              <ul className="space-y-2">
                {(assignedTasksQuery.data ?? []).map((task) => (
                  <li key={task.id} className="rounded-lg border border-brand-mist/60 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-slate">{task.name}</p>
                        <p className="text-xs text-brand-moss">{task.description || "No description"}</p>
                      </div>
                      {canAssignActivities ? (
                        <Button
                          variant="ghost"
                          disabled={unassignTaskMutation.isPending}
                          onClick={() => unassignTaskMutation.mutate(task.id)}
                        >
                          {unassignTaskMutation.isPending ? "Removing..." : "Remove"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {!assignedTasksQuery.isLoading && !assignedTasksQuery.error && (assignedTasksQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-brand-moss">No activities assigned yet.</p>
            ) : null}

            {canAssignActivities ? (
              <div className="mt-4 rounded-lg border border-brand-mist/60 bg-brand-mist/10 p-3">
                <p className="text-sm font-semibold text-brand-slate">Assign Activity Template</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="min-w-[240px] flex-1 rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20"
                  >
                    <option value="">Select activity template</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={
                      !selectedTemplateId ||
                      assignTaskMutation.isPending ||
                      taskTemplatesQuery.isLoading
                    }
                    onClick={() => assignTaskMutation.mutate(selectedTemplateId)}
                  >
                    {assignTaskMutation.isPending ? "Assigning..." : "Assign Activity"}
                  </Button>
                </div>
                {taskTemplatesQuery.error ? (
                  <p className="mt-2 text-sm text-[#b42318]">
                    {taskTemplatesQuery.error instanceof Error ? taskTemplatesQuery.error.message : "Failed to load templates."}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#64748b]">You have view-only access for activity assignments.</p>
            )}
          </Card>

          <Card>
            <SectionTitle title="HODs" subtitle="Heads of department and who assigned them." />
            {hodsQuery.isLoading ? <p className="text-sm text-brand-moss">Loading HODs...</p> : null}
            {hodsQuery.error ? (
              <p className="text-sm text-[#b42318]">
                {hodsQuery.error instanceof Error ? hodsQuery.error.message : "Failed to load HODs."}
              </p>
            ) : null}
            {(hodsQuery.data ?? []).length > 0 ? (
              <ul className="space-y-2">
                {(hodsQuery.data ?? []).map((hod) => (
                  <li key={`${hod.id}-${hod.assignedAt}`} className="rounded-lg border border-brand-mist/60 bg-white p-3">
                    <p className="font-semibold text-brand-slate">{hod.name}</p>
                    <p className="text-xs text-brand-moss">{hod.email}</p>
                    <p className="mt-1 text-xs text-brand-moss">
                      Assigned by {hod.assignedByName ?? "A manager"} on {new Date(hod.assignedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {!hodsQuery.isLoading && !hodsQuery.error && (hodsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-brand-moss">No HOD assigned yet.</p>
            ) : null}

            {canManageMembers ? (
              <form className="mt-4 rounded-lg border border-brand-mist/60 bg-brand-mist/10 p-3" onSubmit={onAssignHod}>
                <p className="text-sm font-semibold text-brand-slate">Assign HOD by Email</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="email"
                    list="department-hod-email-options"
                    value={hodEmail}
                    onChange={(event) => setHodEmail(event.target.value)}
                    placeholder="hod@tenant.com"
                    className="min-w-[240px] flex-1 rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20"
                  />
                  <datalist id="department-hod-email-options">
                    {sortedMemberEmails.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                  <Button
                    type="submit"
                    disabled={assignHodMutation.isPending || tenantMembersQuery.isLoading || sortedMemberEmails.length === 0}
                  >
                    {assignHodMutation.isPending ? "Assigning..." : "Assign HOD"}
                  </Button>
                </div>
                {tenantMembersQuery.error ? (
                  <p className="mt-2 text-sm text-[#b42318]">
                    {tenantMembersQuery.error instanceof Error ? tenantMembersQuery.error.message : "Failed to load members."}
                  </p>
                ) : null}
              </form>
            ) : (
              <p className="mt-3 text-sm text-[#64748b]">You have view-only access for HOD assignments.</p>
            )}
          </Card>

          <Card>
            <SectionTitle title="Department Members" subtitle="Users assigned or home-mapped to this department." />
            {membersQuery.isLoading ? <p className="text-sm text-brand-moss">Loading members...</p> : null}
            {membersQuery.error ? (
              <p className="text-sm text-[#b42318]">
                {membersQuery.error instanceof Error ? membersQuery.error.message : "Failed to load members."}
              </p>
            ) : null}
            {(membersQuery.data ?? []).length > 0 ? (
              <ul className="space-y-2">
                {(membersQuery.data ?? []).map((member) => (
                  <li key={member.id} className="rounded-lg border border-brand-mist/60 bg-white p-3">
                    <p className="font-semibold text-brand-slate">{member.name}</p>
                    <p className="text-xs text-brand-moss">{member.email}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {!membersQuery.isLoading && !membersQuery.error && (membersQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-brand-moss">No department members found.</p>
            ) : null}
          </Card>

          <InlineError message={actionError} />
        </>
      ) : null}

      {canAddDepartment && canManageMembers ? (
        <AddDepartmentModal
          tenantId={tenantId}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
