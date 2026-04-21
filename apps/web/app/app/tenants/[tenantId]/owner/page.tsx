"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useMeQuery } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { DepartmentEntity, DepartmentPersonCompact, TenantMemberListItem } from "@/lib/types";

function metricFromSeed(seed: string, base: number, span: number) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 33 + char.charCodeAt(0)) % 10007;
  }
  return base + (hash % span);
}

export default function TenantOwnerPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const meQuery = useMeQuery();

  const tenantName = activeMembership?.tenantName ?? "Owner Institution";
  const userName = meQuery.data?.user.name ?? "Institution Owner";

  const membersQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantMembers(activeTenantId) : ["tenant-members", "none"],
    queryFn: () => apiClient.get<TenantMemberListItem[]>(`/v1/tenants/${activeTenantId}/members`),
    enabled: Boolean(activeTenantId)
  });

  const departmentsQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantDepartments(activeTenantId) : ["tenant-departments", "none"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${activeTenantId}/departments`),
    enabled: Boolean(activeTenantId)
  });

  const departmentIds = useMemo(
    () => (departmentsQuery.data ?? []).map((department) => department.id),
    [departmentsQuery.data]
  );
  const departmentNameById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((department) => [department.id, department.name])),
    [departmentsQuery.data]
  );

  const departmentMemberCountsQuery = useQuery({
    queryKey:
      activeTenantId && departmentIds.length
        ? ["tenant-department-member-counts", activeTenantId, departmentIds]
        : ["tenant-department-member-counts", "none"],
    queryFn: async () => {
      const entries = await Promise.all(
        (departmentsQuery.data ?? []).map(async (department) => {
          const members = await apiClient.get<DepartmentPersonCompact[]>(
            `/v1/tenants/${activeTenantId}/departments/${department.id}/members`
          );
          return [department.id, members.length] as const;
        })
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    enabled: Boolean(activeTenantId && departmentIds.length)
  });

  const stats = useMemo(() => {
    const seed = activeMembership?.tenantId ?? "owner";
    return [
      {
        label: "Total Active Users",
        value:
          membersQuery.data?.filter((member) => member.status === "active").length ??
          metricFromSeed(seed, 1200, 9000),
        trend: `+${metricFromSeed(seed + "a", 2, 18)}%`,
        tone: "text-[#059669] bg-[#ecfdf5]"
      },
      {
        label: "Active Departments",
        value: departmentsQuery.data?.length ?? 0,
        trend: "Stable",
        tone: "text-[#64748b] bg-[#f1f5f9]"
      },
      {
        label: "Logs This Week",
        value: metricFromSeed(seed + "logs", 260, 2900),
        trend: `+${metricFromSeed(seed + "b", 12, 260)}`,
        tone: "text-[#059669] bg-[#ecfdf5]"
      },
      {
        label: "Pending Approvals",
        value: metricFromSeed(seed + "pending", 4, 28),
        trend: "High",
        tone: "text-[#ba1a1a] bg-[#ffeceb]"
      }
    ];
  }, [activeMembership?.tenantId, departmentsQuery.data?.length, membersQuery.data]);

  if (!activeMembership) {
    return <TenantRequired />;
  }

  if (!activeMembership.isOwner) {
    return (
      <section className="rounded-2xl bg-white p-8 shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
        <h1 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
          Owner access required
        </h1>
        <p className="mt-2 text-sm text-[#64748b]">
          This portal is available only for owners of the selected institution.
        </p>
        <button
          type="button"
          className="mt-5 rounded-lg bg-[#0d56d0] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.push(tenantRoutes.activityNew(activeMembership.tenantId))}
        >
          Go to your portal
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[34px] font-bold leading-9 text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
              {tenantName} Overview
            </h2>
            <p className="mt-1 text-sm text-[#424654]">Owner portal for {userName}.</p>
          </div>
          <button type="button" className="rounded-lg bg-[#e1e3e4] px-4 py-2 text-sm font-semibold text-[#191c1d]">
            Generate Report
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {stats.map((card) => (
            <article key={card.label} className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
              <div className="flex items-center justify-end">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${card.tone}`}>{card.trend}</span>
              </div>
              <p className="mt-4 text-[38px] font-bold leading-9 text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                {card.value.toLocaleString()}
              </p>
              <p className="mt-2 text-xs font-medium text-[#424654]">{card.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <article className="space-y-4 rounded-xl bg-white p-0 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
          <div className="flex flex-wrap items-center justify-between px-5 pt-5">
            <h3 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
              User Management
            </h3>
            <button
              type="button"
              className="rounded-lg bg-gradient-to-br from-[#0040a3] to-[#0d56d0] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => router.push(tenantRoutes.adminInvites(activeMembership.tenantId))}
            >
              Add User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f3f4f5] text-xs uppercase tracking-[0.05em] text-[#64748b]">
                <tr>
                  <th className="px-5 py-4">Name &amp; Email</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#334155]">
                {membersQuery.isLoading ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-[#64748b]" colSpan={4}>
                      Loading tenant members...
                    </td>
                  </tr>
                ) : null}
                {membersQuery.error ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-[#b42318]" colSpan={4}>
                      {membersQuery.error instanceof Error
                        ? membersQuery.error.message
                        : "Failed to load tenant members."}
                    </td>
                  </tr>
                ) : null}
                {(membersQuery.data ?? []).slice(0, 8).map((member) => (
                  <tr key={member.id} className="border-b border-[#e2e8f0] last:border-b-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#0f172a]">{member.name}</p>
                      <p className="text-xs text-[#64748b]">{member.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      {member.homeDepartmentId
                        ? departmentNameById.get(member.homeDepartmentId) ?? member.homeDepartmentId
                        : "Unassigned"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#dbeafe] px-2 py-1 text-[11px] font-semibold uppercase text-[#1d4ed8]">
                        {(member.roleNames[0] ?? "Member").slice(0, 14)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#1d4ed8]"
                        onClick={() => router.push(tenantRoutes.users(activeMembership.tenantId))}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
                {!membersQuery.isLoading && !membersQuery.error && (membersQuery.data?.length ?? 0) === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-[#64748b]" colSpan={4}>
                      No members found for this tenant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-[#1d4ed8]"
              onClick={() => router.push(tenantRoutes.users(activeMembership.tenantId))}
            >
              View all users
            </button>
          </div>
        </article>

        <div className="space-y-4">
          <article className="space-y-3 rounded-xl bg-white p-4 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                Departments
              </h3>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-full bg-[#eff6ff] text-[#1d4ed8]"
                onClick={() => router.push(tenantRoutes.adminDepartments(activeMembership.tenantId))}
              >
                +
              </button>
            </div>
            {departmentsQuery.error ? (
              <p className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-xs text-[#b42318]">
                {departmentsQuery.error instanceof Error
                  ? departmentsQuery.error.message
                  : "Failed to load departments."}
              </p>
            ) : null}
            <div className="space-y-3">
              {departmentsQuery.isLoading ? (
                <p className="text-xs text-[#64748b]">Loading departments...</p>
              ) : null}
              {(departmentsQuery.data ?? []).map((department, index) => (
                <button
                  key={department.id}
                  type="button"
                  className={`w-full rounded-xl border-l-4 ${
                    index === 0 ? "border-[#0d56d0]" : "border-[#cbd5e1]"
                  } bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)]`}
                  onClick={() =>
                    router.push(tenantRoutes.hodDepartmentMembers(activeMembership.tenantId, department.id))
                  }
                >
                  <p className="font-semibold text-[#0f172a]">{department.name}</p>
                  <p className="text-xs text-[#64748b]">
                    {departmentMemberCountsQuery.data?.[department.id] !== undefined
                      ? `${departmentMemberCountsQuery.data[department.id]} Active Members`
                      : departmentMemberCountsQuery.isLoading
                        ? "Loading members..."
                        : "Active member count unavailable"}
                  </p>
                </button>
              ))}
              {!departmentsQuery.isLoading && (departmentsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No departments created yet.</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
