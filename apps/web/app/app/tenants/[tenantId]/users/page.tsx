"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type {
  DepartmentEntity,
  InviteResult,
  TenantRole,
  TenantUsersDirectoryResponse
} from "@/lib/types";

function labelByVisibility(visibility: TenantUsersDirectoryResponse["users"][number]["visibility"]) {
  if (visibility === "member+contributor") {
    return "Member + Contributor";
  }
  if (visibility === "member") {
    return "Member";
  }
  if (visibility === "contributor") {
    return "Contributor";
  }
  return "Tenant User";
}

export default function TenantUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteDepartmentId, setInviteDepartmentId] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantUsersDirectory(activeTenantId) : ["tenant-users-directory", "none"],
    queryFn: () => apiClient.get<TenantUsersDirectoryResponse>(`/v1/tenants/${activeTenantId}/users`),
    enabled: Boolean(activeTenantId)
  });

  const departmentsQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantDepartments(activeTenantId) : ["tenant-departments", "none"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${activeTenantId}/departments`),
    enabled: Boolean(activeTenantId)
  });

  const rolesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.roles(activeTenantId) : ["roles", "none"],
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${activeTenantId}/roles`),
    enabled: Boolean(activeTenantId && activeMembership?.isOwner && isAddUserModalOpen)
  });

  const inviteMutation = useMutation({
    mutationFn: async (input: { email: string; roleId: string; homeDepartmentId: string }) => {
      if (!activeTenantId) {
        throw new Error("No active tenant selected.");
      }
      const email = input.email.trim().toLowerCase();
      return apiClient.post<InviteResult>(`/v1/tenants/${activeTenantId}/invites`, {
        body: {
          email,
          roleId: input.roleId || undefined,
          homeDepartmentId: input.homeDepartmentId || undefined
        }
      });
    },
    onSuccess: async (response) => {
      if (!activeTenantId) {
        return;
      }
      setInviteError(null);
      setInviteSuccess(`Invite sent to ${response.invite.email}.`);
      setInviteEmail("");
      setInviteRoleId("");
      setInviteDepartmentId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantUsersDirectory(activeTenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantMembers(activeTenantId) })
      ]);
    },
    onError: (nextError) => {
      setInviteError(nextError instanceof Error ? nextError.message : "Failed to send invite.");
    }
  });

  const departmentNameById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((department) => [department.id, department.name])),
    [departmentsQuery.data]
  );

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  const directory = usersQuery.data;
  const scopeLabel = directory?.scope === "owner" ? "Owner Scope" : "Department Head Scope";

  function openAddUserModal() {
    setInviteError(null);
    setInviteSuccess(null);
    setInviteEmail("");
    setInviteRoleId("");
    setInviteDepartmentId((departmentsQuery.data ?? [])[0]?.id ?? "");
    setIsAddUserModalOpen(true);
  }

  function closeAddUserModal() {
    if (inviteMutation.isPending) {
      return;
    }
    setIsAddUserModalOpen(false);
    setInviteError(null);
    setInviteSuccess(null);
  }

  function onInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    const email = inviteEmail.trim();
    if (!email) {
      setInviteError("Email is required.");
      return;
    }
    inviteMutation.mutate({
      email,
      roleId: inviteRoleId,
      homeDepartmentId: inviteDepartmentId
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
              Users
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">
              {scopeLabel}. Owner sees all tenant users, HOD sees members and contributors from managed departments.
            </p>
          </div>
          {directory?.scope === "owner" ? (
            <button
              type="button"
              className="rounded-lg bg-gradient-to-br from-[#0040a3] to-[#0d56d0] px-4 py-2 text-sm font-semibold text-white"
              onClick={openAddUserModal}
            >
              Add User
            </button>
          ) : null}
        </div>
        {directory?.scope === "hod" && directory.managedDepartmentIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {directory.managedDepartmentIds.map((departmentId) => (
              <span key={departmentId} className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                {departmentNameById.get(departmentId) ?? departmentId}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-[#f3f4f5] text-xs uppercase tracking-[0.05em] text-[#64748b]">
              <tr>
                <th className="px-5 py-4">Name &amp; Email</th>
                <th className="px-5 py-4">Home Department</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Visibility</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-[#334155]">
              {usersQuery.isLoading ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-[#64748b]" colSpan={5}>
                    Loading users...
                  </td>
                </tr>
              ) : null}
              {usersQuery.error ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-[#b42318]" colSpan={5}>
                    {usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users."}
                  </td>
                </tr>
              ) : null}
              {(directory?.users ?? []).map((user) => (
                <tr key={user.userId} className="border-b border-[#e2e8f0] last:border-b-0">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#0f172a]">{user.name}</p>
                    <p className="text-xs text-[#64748b]">{user.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    {user.homeDepartmentId ? departmentNameById.get(user.homeDepartmentId) ?? user.homeDepartmentId : "Unassigned"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-[#dbeafe] px-2 py-1 text-[11px] font-semibold uppercase text-[#1d4ed8]">
                      {user.isOwner ? "Owner" : user.roleNames[0] ?? "Member"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-[#475569]">{labelByVisibility(user.visibility)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {directory?.scope === "owner" ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#1d4ed8]"
                        onClick={() => router.push(tenantRoutes.adminRoles(activeTenantId))}
                      >
                        Manage Roles
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#1d4ed8]"
                        onClick={() =>
                          router.push(
                            tenantRoutes.hodDepartmentMembers(
                              activeTenantId,
                              user.departmentIds[0] ?? directory?.managedDepartmentIds[0] ?? ""
                            )
                          )
                        }
                        disabled={!user.departmentIds[0] && !directory?.managedDepartmentIds[0]}
                      >
                        Open Department
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!usersQuery.isLoading && !usersQuery.error && (directory?.users.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-[#64748b]" colSpan={5}>
                    No users available in your current visibility scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isAddUserModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4"
          onClick={closeAddUserModal}
        >
          <section
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                  Add User
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Invite a user with tenant role and optional home department assignment.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold text-[#64748b] hover:bg-[#f1f5f9]"
                onClick={closeAddUserModal}
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={onInviteSubmit}>
              <div>
                <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">
                  Email ID
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                  className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
                  placeholder="new.user@example.com"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="invite-role" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRoleId}
                    onChange={(event) => setInviteRoleId(event.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
                    disabled={rolesQuery.isLoading}
                  >
                    <option value="">Default (Staff)</option>
                    {(rolesQuery.data ?? []).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="invite-department" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">
                    Department
                  </label>
                  <select
                    id="invite-department"
                    value={inviteDepartmentId}
                    onChange={(event) => setInviteDepartmentId(event.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
                    disabled={departmentsQuery.isLoading}
                  >
                    <option value="">Unassigned (assign later)</option>
                    {(departmentsQuery.data ?? []).map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(departmentsQuery.data?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-xs text-[#1d4ed8]">
                  No departments found. You can still send invite now and assign department later.
                </p>
              ) : null}
              {inviteError ? (
                <p className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#b42318]">
                  {inviteError}
                </p>
              ) : null}
              {inviteSuccess ? (
                <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534]">
                  {inviteSuccess}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#334155]"
                  onClick={closeAddUserModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-br from-[#0040a3] to-[#0d56d0] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
