"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import { validateInviteRoleInput } from "@/lib/invite-validation";
import { formatDate } from "@/lib/format";
import type { InviteResult, DepartmentEntity, TenantInviteListItem, TenantRole } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

export function InviteForm({ tenantId }: { tenantId: string }) {
  const apiClient = useApiClient();
  const [email, setEmail] = useState("");
  const [homeDepartmentId, setHomeDepartmentId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles(tenantId),
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${tenantId}/roles`)
  });

  const departmentsQuery = useQuery({
    queryKey: queryKeys.tenantDepartments(tenantId),
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${tenantId}/departments`)
  });

  const invitesQuery = useQuery({
    queryKey: queryKeys.tenantInvites(tenantId),
    queryFn: () => apiClient.get<TenantInviteListItem[]>(`/v1/tenants/${tenantId}/invites`)
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiClient.post<InviteResult>(`/v1/tenants/${tenantId}/invites`, {
        body: {
          email: email.trim(),
          homeDepartmentId: homeDepartmentId.trim() || undefined,
          roleId: roleId || undefined
        }
      }),
    onSuccess: () => {
      setEmail("");
      setRoleId("");
      void invitesQuery.refetch();
      setError(null);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to send invite.");
    }
  });

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    const validationError = validateInviteRoleInput({ roleId, roleIds: [] });
    if (validationError) {
      setError(validationError);
      return;
    }
    inviteMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Create Invite" subtitle="Invite by email. Membership is created only after the user accepts." />
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onInvite}>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="invite-home-department">Department</Label>
            <Select
              id="invite-home-department"
              value={homeDepartmentId}
              onChange={(event) => setHomeDepartmentId(event.target.value)}
            >
              <option value="">Unassigned (assign later)</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="invite-role-id">Role</Label>
            <Select id="invite-role-id" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">Default (Staff)</option>
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending Invite..." : "Create Invite"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Invites" subtitle="View invite lifecycle across pending, accepted, and revoked states." />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-mist/40 text-xs uppercase tracking-wide text-brand-moss">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Invited By</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Accepted</th>
              </tr>
            </thead>
            <tbody>
              {invitesQuery.isLoading ? (
                <tr>
                  <td className="px-3 py-2 text-brand-moss" colSpan={7}>
                    Loading invites...
                  </td>
                </tr>
              ) : null}
              {invitesQuery.error ? (
                <tr>
                  <td className="px-3 py-2 text-red-700" colSpan={7}>
                    {invitesQuery.error instanceof Error ? invitesQuery.error.message : "Failed to load invites."}
                  </td>
                </tr>
              ) : null}
              {(invitesQuery.data ?? []).map((invite) => (
                <tr key={invite.id} className="border-b border-brand-mist/50 last:border-b-0">
                  <td className="px-3 py-2 text-brand-slate">{invite.email}</td>
                  <td className="px-3 py-2 text-brand-slate">
                    {(departmentsQuery.data ?? []).find((department) => department.id === invite.homeDepartmentId)?.name ??
                      "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-brand-slate">{invite.roleNames.join(", ") || "Staff"}</td>
                  <td className="px-3 py-2 text-brand-slate">{invite.status}</td>
                  <td className="px-3 py-2 text-brand-slate">{invite.invitedByName ?? "System"}</td>
                  <td className="px-3 py-2 text-brand-slate">{formatDate(invite.createdAt)}</td>
                  <td className="px-3 py-2 text-brand-slate">
                    {invite.acceptedAt ? formatDate(invite.acceptedAt) : "-"}
                  </td>
                </tr>
              ))}
              {!invitesQuery.isLoading && !invitesQuery.error && (invitesQuery.data?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-brand-moss" colSpan={7}>
                    No invites sent yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <InlineError message={error} />
      </Card>
    </div>
  );
}
