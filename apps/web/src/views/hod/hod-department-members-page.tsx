"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { queryKeys } from "@/lib/query-keys";
import type { DepartmentContributorCompact, DepartmentPersonCompact } from "@/lib/types";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export default function HodDepartmentMembersPage() {
  const params = useParams<{ departmentId: string }>();
  const departmentId = params.departmentId;
  const apiClient = useApiClient();
  const { activeTenantId } = useActiveTenant();

  const membersQuery = useQuery({
    queryKey:
      activeTenantId && departmentId
        ? queryKeys.departmentMembers(activeTenantId, departmentId)
        : ["department-members", "none"],
    queryFn: () =>
      apiClient.get<DepartmentPersonCompact[]>(
        `/v1/tenants/${activeTenantId}/departments/${departmentId}/members`
      ),
    enabled: Boolean(activeTenantId && departmentId)
  });

  const contributorsQuery = useQuery({
    queryKey:
      activeTenantId && departmentId
        ? queryKeys.departmentContributors(activeTenantId, departmentId)
        : ["department-contributors", "none"],
    queryFn: () =>
      apiClient.get<DepartmentContributorCompact[]>(
        `/v1/tenants/${activeTenantId}/departments/${departmentId}/contributors`
      ),
    enabled: Boolean(activeTenantId && departmentId)
  });

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Department Visibility"
          subtitle={`Department ${departmentId} member and contributor views`}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle title="Members" subtitle="Assigned/home department users." />
          {membersQuery.isLoading ? <p className="text-sm text-brand-moss">Loading members...</p> : null}
          {membersQuery.error ? (
            <p className="text-sm text-red-700">
              {membersQuery.error instanceof Error ? membersQuery.error.message : "Failed to load members."}
            </p>
          ) : null}
          {(membersQuery.data ?? []).length ? (
            <ul className="space-y-2 text-sm">
              {(membersQuery.data ?? []).map((member) => (
                <li key={member.id} className="rounded-lg border border-brand-mist/60 bg-white p-2">
                  <p className="font-semibold text-brand-slate">{member.name}</p>
                  <p className="text-xs text-brand-moss">{member.email}</p>
                  <p className="font-mono text-xs text-brand-moss">{member.id}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brand-moss">No department members found.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Contributors" subtitle="Users who logged work but are not department members." />
          {contributorsQuery.isLoading ? <p className="text-sm text-brand-moss">Loading contributors...</p> : null}
          {contributorsQuery.error ? (
            <p className="text-sm text-red-700">
              {contributorsQuery.error instanceof Error
                ? contributorsQuery.error.message
                : "Failed to load contributors."}
            </p>
          ) : null}
          {(contributorsQuery.data ?? []).length ? (
            <ul className="space-y-2 text-sm">
              {(contributorsQuery.data ?? []).map((contributor) => (
                <li key={contributor.id} className="rounded-lg border border-brand-mist/60 bg-white p-2">
                  <p className="font-semibold text-brand-slate">{contributor.name}</p>
                  <p className="text-xs text-brand-moss">{contributor.email}</p>
                  <p className="text-xs text-brand-moss">
                    Entries: {contributor.entryCount} | Latest: {formatDate(contributor.latestEntryAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brand-moss">No cross-department contributors found.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

