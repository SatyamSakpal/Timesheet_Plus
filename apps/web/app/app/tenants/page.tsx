"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useAppStore } from "@/store/app-store";
import { queryKeys } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import { Button, Card, InlineError, Input, Label, SectionTitle } from "@/components/ui/primitives";

interface CreatedTenant {
  id: string;
  name: string;
}

export default function TenantsPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { memberships, activeTenantId } = useActiveTenant();
  const setActiveTenantId = useAppStore((state) => state.setActiveTenantId);

  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createTenantMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post<CreatedTenant>("/v1/tenants", { body: { name } }),
    onSuccess: async (tenant) => {
      setTenantName("");
      setActiveTenantId(tenant.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create tenant.");
    }
  });

  function onCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const name = tenantName.trim();
    if (!name) {
      setError("Tenant name is required.");
      return;
    }
    createTenantMutation.mutate(name);
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Tenant Memberships" subtitle="Switch active tenant and inspect membership records." />
        <div className="space-y-2">
          {memberships.length === 0 ? (
            <p className="text-sm text-brand-moss">No memberships found yet.</p>
          ) : (
            memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex flex-col justify-between gap-2 rounded-md border border-brand-mist/70 bg-white p-3 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-semibold text-brand-slate">
                    Tenant: {membership.tenantName ?? "Unnamed Tenant"}
                  </p>
                  <p className="text-xs text-brand-moss">
                    Status: {membership.status}
                  </p>
                  <p className="text-xs text-brand-moss">Updated: {formatDate(membership.updatedAt)}</p>
                </div>
                <Button
                  variant={membership.tenantId === activeTenantId ? "secondary" : "primary"}
                  onClick={() => setActiveTenantId(membership.tenantId)}
                >
                  {membership.tenantId === activeTenantId ? "Active" : "Set Active"}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Create Tenant" subtitle="Creates a tenant and seeds Owner/HOD/Staff roles." />
        <form className="max-w-md space-y-3" onSubmit={onCreateTenant}>
          <div>
            <Label htmlFor="tenant-name">Tenant Name</Label>
            <Input
              id="tenant-name"
              value={tenantName}
              onChange={(event) => setTenantName(event.target.value)}
              placeholder="Acme Corporation"
              required
            />
          </div>
          <InlineError message={error} />
          <Button type="submit" disabled={createTenantMutation.isPending}>
            {createTenantMutation.isPending ? "Creating..." : "Create Tenant"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
