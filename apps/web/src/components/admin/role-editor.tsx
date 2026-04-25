"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import type { PermissionCatalogItem, TenantRole } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle } from "@/components/ui/primitives";

export function RoleEditor({ tenantId }: { tenantId: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageRoles =
    (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.roleManage);

  const permissionsQuery = useQuery({
    queryKey: queryKeys.permissionsCatalog,
    queryFn: () => apiClient.get<PermissionCatalogItem[]>("/v1/catalog/permissions")
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles(tenantId),
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${tenantId}/roles`)
  });

  const createRoleMutation = useMutation({
    mutationFn: (input: { name: string; permissionKeys: string[] }) =>
      apiClient.post<TenantRole>(`/v1/tenants/${tenantId}/roles`, { body: input }),
    onSuccess: async () => {
      setName("");
      setSelectedPermissions({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles(tenantId) });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create role.");
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => apiClient.delete<TenantRole>(`/v1/tenants/${tenantId}/roles/${roleId}`),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles(tenantId) });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete role.");
    },
    onSettled: () => {
      setDeletingRoleId(null);
    }
  });

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionCatalogItem[]>();
    for (const permission of permissionsQuery.data ?? []) {
      const group = groups.get(permission.module) ?? [];
      group.push(permission);
      groups.set(permission.module, group);
    }
    return [...groups.entries()];
  }, [permissionsQuery.data]);

  function onToggle(permissionKey: string) {
    setSelectedPermissions((state) => ({ ...state, [permissionKey]: !state[permissionKey] }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const permissionKeys = Object.entries(selectedPermissions)
      .filter(([, checked]) => checked)
      .map(([key]) => key);

    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    if (permissionKeys.length === 0) {
      setError("Select at least one permission.");
      return;
    }
    if (!canManageRoles) {
      setError("You do not have permission to manage roles.");
      return;
    }
    createRoleMutation.mutate({ name: name.trim(), permissionKeys });
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Existing Roles" subtitle="Includes seeded Owner / Head of Department / Staff roles." />
        {rolesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading roles...</p> : null}
        {rolesQuery.error ? (
          <InlineError message={rolesQuery.error instanceof Error ? rolesQuery.error.message : "Failed to load roles."} />
        ) : null}
        <div className="space-y-2">
          {(rolesQuery.data ?? []).map((role) => (
            <div key={role.id} className="rounded-md border border-brand-mist/60 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-slate">
                    {role.name} {role.isSystem ? "(System)" : ""}
                  </p>
                  <p className="mt-1 text-xs text-brand-moss">{role.permissionKeys.join(", ")}</p>
                </div>
                {canManageRoles && !role.isSystem ? (
                  <Button
                    variant="ghost"
                    disabled={deleteRoleMutation.isPending}
                    onClick={() => {
                      const ok = window.confirm(`Delete role "${role.name}"?`);
                      if (!ok) {
                        return;
                      }
                      setDeletingRoleId(role.id);
                      deleteRoleMutation.mutate(role.id);
                    }}
                  >
                    {deleteRoleMutation.isPending && deletingRoleId === role.id ? "Deleting..." : "Delete"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Create Role" subtitle="Permission keys are sourced from /v1/catalog/permissions." />
        {!canManageRoles ? (
          <p className="text-sm text-brand-moss">You have view-only access for roles.</p>
        ) : null}
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="max-w-md">
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Finance Reviewer"
              disabled={!canManageRoles}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {groupedPermissions.map(([module, permissions]) => (
              <div key={module} className="rounded-md border border-brand-mist/60 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-moss">{module}</p>
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <label key={permission.key} className="flex items-start gap-2 text-sm text-brand-slate">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedPermissions[permission.key])}
                        onChange={() => onToggle(permission.key)}
                        disabled={!canManageRoles}
                      />
                      <span>
                        <span className="font-semibold">{permission.name}</span>
                        <span className="block text-xs text-brand-moss">{permission.key}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <InlineError message={error} />
          <Button type="submit" disabled={createRoleMutation.isPending || !canManageRoles}>
            {createRoleMutation.isPending ? "Creating..." : "Create Role"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
