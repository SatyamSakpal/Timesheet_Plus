"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useMeQuery } from "@/hooks/use-me";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type {
  ActivityEntry,
  DepartmentEntity,
  DepartmentPersonCompact,
  TenantMemberListItem,
  TenantUsersDirectoryResponse
} from "@/lib/types";

function localDateValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + delta);
  return normalized;
}

function formatPercentTrend(current: number, previous: number): string {
  if (previous === 0) {
    if (current === 0) {
      return "0%";
    }
    return "+100%";
  }
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

export default function TenantOwnerPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const meQuery = useMeQuery();
  const { permissions } = useTenantPermissions();
  const [hodDepartmentFilter, setHodDepartmentFilter] = useState("all");

  const tenantName = activeMembership?.tenantName ?? "Owner Institution";
  const userName = meQuery.data?.user.name ?? "Institution Owner";
  const canAccessHodDashboard =
    permissions.has(PERMISSIONS.activityApprove) || permissions.has(PERMISSIONS.reportView);

  const membersQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantMembers(activeTenantId) : ["tenant-members", "none"],
    queryFn: () => apiClient.get<TenantMemberListItem[]>(`/v1/tenants/${activeTenantId}/members`),
    enabled: Boolean(activeTenantId && activeMembership?.isOwner)
  });

  const departmentsQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantDepartments(activeTenantId) : ["tenant-departments", "none"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${activeTenantId}/departments`),
    enabled: Boolean(activeTenantId)
  });

  const usersDirectoryQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantUsersDirectory(activeTenantId) : ["tenant-users-directory", "none"],
    queryFn: () => apiClient.get<TenantUsersDirectoryResponse>(`/v1/tenants/${activeTenantId}/users`),
    enabled: Boolean(activeTenantId && activeMembership && !activeMembership.isOwner && canAccessHodDashboard)
  });

  const departmentIds = useMemo(
    () => (departmentsQuery.data ?? []).map((department) => department.id),
    [departmentsQuery.data]
  );
  const departmentNameById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((department) => [department.id, department.name])),
    [departmentsQuery.data]
  );
  const formatDepartment = (departmentId: string) =>
    departmentNameById.get(departmentId) ?? "Unknown department";

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
    enabled: Boolean(activeTenantId && activeMembership?.isOwner && departmentIds.length)
  });

  const ownerDepartmentStatsQuery = useQuery({
    queryKey:
      activeTenantId && departmentIds.length
        ? ["owner-dashboard-department-stats", activeTenantId, departmentIds]
        : ["owner-dashboard-department-stats", "none"],
    queryFn: async () => {
      const allActivities = await Promise.all(
        (departmentsQuery.data ?? []).map((department) =>
          apiClient.get<ActivityEntry[]>(
            `/v1/tenants/${activeTenantId}/departments/${department.id}/activities`
          )
        )
      );
      return allActivities.flat();
    },
    enabled: Boolean(activeTenantId && activeMembership?.isOwner && departmentIds.length)
  });

  const managedDepartmentIds = useMemo(
    () =>
      usersDirectoryQuery.data?.scope === "hod"
        ? usersDirectoryQuery.data.managedDepartmentIds
        : [],
    [usersDirectoryQuery.data]
  );

  const effectiveHodFilter =
    hodDepartmentFilter === "all" || managedDepartmentIds.includes(hodDepartmentFilter)
      ? hodDepartmentFilter
      : "all";

  const hodIncludedDepartmentIds = useMemo(
    () => (effectiveHodFilter === "all" ? managedDepartmentIds : [effectiveHodFilter]),
    [effectiveHodFilter, managedDepartmentIds]
  );

  const hodDepartmentStatsQuery = useQuery({
    queryKey:
      activeTenantId && hodIncludedDepartmentIds.length
        ? ["hod-dashboard-department-stats", activeTenantId, hodIncludedDepartmentIds]
        : ["hod-dashboard-department-stats", "none"],
    queryFn: async () => {
      const entries = await Promise.all(
        hodIncludedDepartmentIds.map(async (departmentId) => {
          const activities = await apiClient.get<ActivityEntry[]>(
            `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`
          );
          const summary = {
            departmentId,
            totalLogs: activities.length,
            draftCount: 0,
            pendingReviewCount: 0,
            approvedCount: 0,
            rejectedCount: 0
          };
          for (const activity of activities) {
            if (activity.status === "draft") {
              summary.draftCount += 1;
            } else if (activity.status === "submitted" || activity.status === "resubmitted") {
              summary.pendingReviewCount += 1;
            } else if (activity.status === "approved") {
              summary.approvedCount += 1;
            } else if (activity.status === "rejected") {
              summary.rejectedCount += 1;
            }
          }
          return summary;
        })
      );
      return entries.sort((left, right) => {
        const leftName = formatDepartment(left.departmentId);
        const rightName = formatDepartment(right.departmentId);
        return leftName.localeCompare(rightName);
      });
    },
    enabled: Boolean(activeTenantId && !activeMembership?.isOwner && hodIncludedDepartmentIds.length)
  });

  const hodAggregateStats = useMemo(() => {
    return (hodDepartmentStatsQuery.data ?? []).reduce(
      (accumulator, department) => ({
        totalLogs: accumulator.totalLogs + department.totalLogs,
        draftCount: accumulator.draftCount + department.draftCount,
        pendingReviewCount: accumulator.pendingReviewCount + department.pendingReviewCount,
        approvedCount: accumulator.approvedCount + department.approvedCount,
        rejectedCount: accumulator.rejectedCount + department.rejectedCount
      }),
      {
        totalLogs: 0,
        draftCount: 0,
        pendingReviewCount: 0,
        approvedCount: 0,
        rejectedCount: 0
      }
    );
  }, [hodDepartmentStatsQuery.data]);

  const ownerActivityStats = useMemo(() => {
    const allActivities = ownerDepartmentStatsQuery.data ?? [];
    const pendingApprovals = allActivities.filter(
      (activity) => activity.status === "submitted" || activity.status === "resubmitted"
    ).length;

    const now = new Date();
    const currentWeekStartDate = startOfWeek(now);
    const currentWeekEndDate = addDays(currentWeekStartDate, 6);
    const previousWeekStartDate = addDays(currentWeekStartDate, -7);
    const previousWeekEndDate = addDays(currentWeekStartDate, -1);

    const currentWeekStart = localDateValue(currentWeekStartDate);
    const currentWeekEnd = localDateValue(currentWeekEndDate);
    const previousWeekStart = localDateValue(previousWeekStartDate);
    const previousWeekEnd = localDateValue(previousWeekEndDate);

    const logsThisWeek = allActivities.filter(
      (activity) => activity.activityDate >= currentWeekStart && activity.activityDate <= currentWeekEnd
    ).length;
    const logsPreviousWeek = allActivities.filter(
      (activity) => activity.activityDate >= previousWeekStart && activity.activityDate <= previousWeekEnd
    ).length;

    return {
      logsThisWeek,
      logsPreviousWeek,
      pendingApprovals
    };
  }, [ownerDepartmentStatsQuery.data]);

  const stats = useMemo(() => {
    return [
      {
        label: "Total Active Users",
        value: membersQuery.data?.filter((member) => member.status === "active").length ?? 0,
        trend: "Live",
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
        value: ownerActivityStats.logsThisWeek,
        trend: formatPercentTrend(ownerActivityStats.logsThisWeek, ownerActivityStats.logsPreviousWeek),
        tone: "text-[#059669] bg-[#ecfdf5]"
      },
      {
        label: "Pending Approvals",
        value: ownerActivityStats.pendingApprovals,
        trend: "Live",
        tone: "text-[#ba1a1a] bg-[#ffeceb]"
      }
    ];
  }, [
    departmentsQuery.data?.length,
    membersQuery.data,
    ownerActivityStats.logsPreviousWeek,
    ownerActivityStats.logsThisWeek,
    ownerActivityStats.pendingApprovals
  ]);

  if (!activeMembership) {
    return <TenantRequired />;
  }

  if (!activeMembership.isOwner && canAccessHodDashboard && usersDirectoryQuery.isLoading) {
    return (
      <section className="rounded-2xl bg-white p-8 shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
        <h1 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
          Loading dashboard
        </h1>
        <p className="mt-2 text-sm text-[#64748b]">Resolving your department dashboard scope...</p>
      </section>
    );
  }

  if (!activeMembership.isOwner && usersDirectoryQuery.data?.scope === "hod") {
    return (
      <div className="space-y-6">
        <section className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[32px] font-bold leading-9 text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                {tenantName} HOD Dashboard
              </h2>
              <p className="mt-1 text-sm text-[#424654]">
                Department-level stats for {userName}. Data scope:{" "}
                {hodIncludedDepartmentIds.length === 1
                  ? formatDepartment(hodIncludedDepartmentIds[0])
                  : "All managed departments"}
                .
              </p>
            </div>
            <div className="w-full max-w-[280px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">
                Department Filter
              </label>
              <select
                className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
                value={effectiveHodFilter}
                onChange={(event) => setHodDepartmentFilter(event.target.value)}
              >
                <option value="all">All Managed Departments</option>
                {managedDepartmentIds.map((departmentId) => (
                  <option key={departmentId} value={departmentId}>
                    {formatDepartment(departmentId)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {hodIncludedDepartmentIds.map((departmentId) => (
              <span key={departmentId} className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                {formatDepartment(departmentId)}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <article className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
            <p className="text-xs font-medium text-[#424654]">Total Logs</p>
            <p className="mt-2 text-[34px] font-bold text-[#0f172a]">{hodAggregateStats.totalLogs.toLocaleString()}</p>
          </article>
          <article className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
            <p className="text-xs font-medium text-[#424654]">Pending Review</p>
            <p className="mt-2 text-[34px] font-bold text-[#0f172a]">{hodAggregateStats.pendingReviewCount.toLocaleString()}</p>
          </article>
          <article className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
            <p className="text-xs font-medium text-[#424654]">Approved</p>
            <p className="mt-2 text-[34px] font-bold text-[#0f172a]">{hodAggregateStats.approvedCount.toLocaleString()}</p>
          </article>
          <article className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
            <p className="text-xs font-medium text-[#424654]">Rejected</p>
            <p className="mt-2 text-[34px] font-bold text-[#0f172a]">{hodAggregateStats.rejectedCount.toLocaleString()}</p>
          </article>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
          <h3 className="text-lg font-semibold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
            Department Breakdown
          </h3>
          {hodDepartmentStatsQuery.isLoading ? (
            <p className="mt-3 text-sm text-[#64748b]">Loading department stats...</p>
          ) : null}
          {hodDepartmentStatsQuery.error ? (
            <p className="mt-3 text-sm text-[#b42318]">
              {hodDepartmentStatsQuery.error instanceof Error
                ? hodDepartmentStatsQuery.error.message
                : "Failed to load department stats."}
            </p>
          ) : null}
          {(hodDepartmentStatsQuery.data ?? []).length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f4f5] text-xs uppercase tracking-[0.05em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Draft</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Approved</th>
                    <th className="px-4 py-3">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {(hodDepartmentStatsQuery.data ?? []).map((row) => (
                    <tr key={row.departmentId} className="border-b border-[#e2e8f0] last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">
                        {formatDepartment(row.departmentId)}
                      </td>
                      <td className="px-4 py-3">{row.totalLogs}</td>
                      <td className="px-4 py-3">{row.draftCount}</td>
                      <td className="px-4 py-3">{row.pendingReviewCount}</td>
                      <td className="px-4 py-3">{row.approvedCount}</td>
                      <td className="px-4 py-3">{row.rejectedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !hodDepartmentStatsQuery.isLoading ? (
            <p className="mt-3 text-sm text-[#64748b]">No department data available in your current scope.</p>
          ) : null}
        </section>
      </div>
    );
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
                      <button
                        type="button"
                        className="text-left font-semibold text-[#0f172a] hover:text-[#1d4ed8] hover:underline"
                        onClick={() => router.push(tenantRoutes.userDetail(activeMembership.tenantId, member.userId))}
                      >
                        {member.name}
                      </button>
                      <p className="text-xs text-[#64748b]">{member.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      {member.homeDepartmentId
                        ? formatDepartment(member.homeDepartmentId)
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
                        onClick={() => router.push(tenantRoutes.userDetail(activeMembership.tenantId, member.userId))}
                      >
                        Open Profile
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
