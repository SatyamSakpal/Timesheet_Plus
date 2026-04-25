"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import type {
  ActivityEntry,
  DepartmentContributorCompact,
  DepartmentEntity,
  DepartmentPersonCompact,
  TaskTemplate,
  TenantUsersDirectoryResponse
} from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { ActivityDetailDrawer } from "@/components/hod/activity-detail-drawer";
import { ApproveRejectActions } from "@/components/hod/approve-reject-actions";
import { ReviewTable } from "@/components/hod/review-table";
import { TenantRequired } from "@/components/layout/tenant-required";
import { tenantRoutes } from "@/lib/tenant-routes";
import { formatDate } from "@/lib/format";
import { Button, Card, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

type DateFilterMode = "single" | "range";
type ReviewStatusFilter = "" | "pending" | ActivityEntry["status"];

interface FilterState {
  departmentId: string;
  status: ReviewStatusFilter;
  userId: string;
  taskTemplateId: string;
  dateMode: DateFilterMode;
  dateFrom: string;
  dateTo: string;
}

interface PendingUserRow extends DepartmentPersonCompact {
  pendingCount: number;
  latestPendingAt: string | null;
}

function createDefaultFilters(defaultDepartmentId: string): FilterState {
  return {
    departmentId: defaultDepartmentId,
    status: "pending",
    userId: "",
    taskTemplateId: "",
    dateMode: "range",
    dateFrom: "",
    dateTo: ""
  };
}

function localDateValue(date = new Date()): string {
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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateLabel(dateKey: string): string {
  if (!dateKey) {
    return "Any date";
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function toIsoStart(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function toIsoEnd(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export default function HodReviewPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId } = useActiveTenant();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEntry | null>(null);
  const [submittedFilters, setSubmittedFilters] = useState<FilterState>(() => createDefaultFilters(""));
  const [filterDraft, setFilterDraft] = useState<FilterState>(() => createDefaultFilters(""));

  const filterSignature = useMemo(() => JSON.stringify(submittedFilters), [submittedFilters]);

  const usersDirectoryQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantUsersDirectory(activeTenantId) : ["tenant-users-directory", "none"],
    queryFn: () => apiClient.get<TenantUsersDirectoryResponse>(`/v1/tenants/${activeTenantId}/users`),
    enabled: Boolean(activeTenantId)
  });

  const departmentsQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantDepartments(activeTenantId) : ["tenant-departments", "none"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${activeTenantId}/departments`),
    enabled: Boolean(activeTenantId)
  });

  const managedDepartments = useMemo(() => {
    const allDepartments = departmentsQuery.data ?? [];
    const directory = usersDirectoryQuery.data;
    if (!directory) {
      return [] as DepartmentEntity[];
    }

    if (directory.scope === "owner") {
      return allDepartments;
    }

    const managedIds = directory.managedDepartmentIds;
    const departmentsById = new Map(allDepartments.map((department) => [department.id, department]));
    return managedIds
      .map((departmentId) => departmentsById.get(departmentId))
      .filter((department): department is DepartmentEntity => Boolean(department));
  }, [departmentsQuery.data, usersDirectoryQuery.data]);

  useEffect(() => {
    if (managedDepartments.length === 0) {
      return;
    }
    const availableDepartmentIds = new Set(managedDepartments.map((department) => department.id));
    const fallbackDepartmentId = managedDepartments[0].id;

    setSubmittedFilters((current) =>
      availableDepartmentIds.has(current.departmentId)
        ? current
        : { ...current, departmentId: fallbackDepartmentId }
    );
    setFilterDraft((current) =>
      availableDepartmentIds.has(current.departmentId)
        ? current
        : { ...current, departmentId: fallbackDepartmentId }
    );
  }, [managedDepartments]);

  const draftDateRangeError = useMemo(() => {
    if (filterDraft.dateMode !== "range") {
      return null;
    }
    if (!filterDraft.dateFrom || !filterDraft.dateTo) {
      return "Start and end dates are required for a range.";
    }
    if (filterDraft.dateTo < filterDraft.dateFrom) {
      return "End date must be on or after start date.";
    }
    return null;
  }, [filterDraft.dateFrom, filterDraft.dateMode, filterDraft.dateTo]);

  const resolvedSubmittedDateRange = useMemo(() => {
    if (!submittedFilters.dateFrom) {
      return { dateFrom: undefined, dateTo: undefined };
    }
    if (submittedFilters.dateMode === "single") {
      return {
        dateFrom: toIsoStart(submittedFilters.dateFrom),
        dateTo: toIsoEnd(submittedFilters.dateFrom)
      };
    }
    if (!submittedFilters.dateTo) {
      return { dateFrom: undefined, dateTo: undefined };
    }
    return {
      dateFrom: toIsoStart(submittedFilters.dateFrom),
      dateTo: toIsoEnd(submittedFilters.dateTo)
    };
  }, [submittedFilters.dateFrom, submittedFilters.dateMode, submittedFilters.dateTo]);

  const activitiesQuery = useQuery({
    queryKey:
      activeTenantId && submittedFilters.departmentId
        ? queryKeys.departmentActivities(activeTenantId, submittedFilters.departmentId, filterSignature)
        : ["hod-review", "none"],
    queryFn: async () => {
      const baseQuery = {
        userId: submittedFilters.userId || undefined,
        taskTemplateId: submittedFilters.taskTemplateId || undefined,
        dateFrom: resolvedSubmittedDateRange.dateFrom,
        dateTo: resolvedSubmittedDateRange.dateTo
      };

      if (submittedFilters.status === "pending") {
        const [submitted, resubmitted] = await Promise.all([
          apiClient.get<ActivityEntry[]>(
            `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
            { query: { ...baseQuery, status: "submitted" } }
          ),
          apiClient.get<ActivityEntry[]>(
            `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
            { query: { ...baseQuery, status: "resubmitted" } }
          )
        ]);
        const map = new Map<string, ActivityEntry>();
        for (const activity of [...submitted, ...resubmitted]) {
          map.set(activity.id, activity);
        }
        return [...map.values()].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
      }

      return apiClient.get<ActivityEntry[]>(
        `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
        {
          query: {
            ...baseQuery,
            status: submittedFilters.status || undefined
          }
        }
      );
    },
    enabled: Boolean(activeTenantId && submittedFilters.departmentId)
  });

  const membersQuery = useQuery({
    queryKey:
      activeTenantId && submittedFilters.departmentId
        ? queryKeys.departmentMembers(activeTenantId, submittedFilters.departmentId)
        : ["review-department-members", "none"],
    queryFn: () =>
      apiClient.get<DepartmentPersonCompact[]>(
        `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/members`
      ),
    enabled: Boolean(activeTenantId && submittedFilters.departmentId)
  });

  const contributorsQuery = useQuery({
    queryKey:
      activeTenantId && submittedFilters.departmentId
        ? queryKeys.departmentContributors(activeTenantId, submittedFilters.departmentId)
        : ["review-department-contributors", "none"],
    queryFn: () =>
      apiClient.get<DepartmentContributorCompact[]>(
        `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/contributors`
      ),
    enabled: Boolean(activeTenantId && submittedFilters.departmentId)
  });

  const pendingActivitiesQuery = useQuery({
    queryKey:
      activeTenantId && submittedFilters.departmentId
        ? ["review-pending-activities", activeTenantId, submittedFilters.departmentId]
        : ["review-pending-activities", "none"],
    queryFn: async () => {
      const [submitted, resubmitted] = await Promise.all([
        apiClient.get<ActivityEntry[]>(
          `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
          { query: { status: "submitted" } }
        ),
        apiClient.get<ActivityEntry[]>(
          `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
          { query: { status: "resubmitted" } }
        )
      ]);
      return [...submitted, ...resubmitted];
    },
    enabled: Boolean(activeTenantId && submittedFilters.departmentId)
  });

  const departmentTasksQuery = useQuery({
    queryKey:
      activeTenantId && filterDraft.departmentId
        ? queryKeys.departmentTasks(activeTenantId, filterDraft.departmentId)
        : ["department-tasks", "none"],
    queryFn: () =>
      apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/departments/${filterDraft.departmentId}/tasks`),
    enabled: Boolean(activeTenantId && filterDraft.departmentId)
  });

  const departmentNameById = useMemo(
    () => new Map((managedDepartments ?? []).map((department) => [department.id, department.name])),
    [managedDepartments]
  );

  const pendingByUserId = useMemo(() => {
    const map = new Map<string, { count: number; latest: string | null }>();
    for (const activity of pendingActivitiesQuery.data ?? []) {
      const current = map.get(activity.userId);
      if (!current) {
        map.set(activity.userId, { count: 1, latest: activity.createdAt });
      } else {
        current.count += 1;
        if (!current.latest || activity.createdAt > current.latest) {
          current.latest = activity.createdAt;
        }
      }
    }
    return map;
  }, [pendingActivitiesQuery.data]);

  const pendingMembers = useMemo<PendingUserRow[]>(() => {
    return (membersQuery.data ?? [])
      .filter((member) => pendingByUserId.has(member.id))
      .map((member) => ({
        ...member,
        pendingCount: pendingByUserId.get(member.id)?.count ?? 0,
        latestPendingAt: pendingByUserId.get(member.id)?.latest ?? null
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [membersQuery.data, pendingByUserId]);

  const pendingContributors = useMemo<PendingUserRow[]>(() => {
    return (contributorsQuery.data ?? [])
      .filter((contributor) => pendingByUserId.has(contributor.id))
      .map((contributor) => ({
        id: contributor.id,
        name: contributor.name,
        email: contributor.email,
        pendingCount: pendingByUserId.get(contributor.id)?.count ?? 0,
        latestPendingAt: pendingByUserId.get(contributor.id)?.latest ?? null
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [contributorsQuery.data, pendingByUserId]);

  const reviewableUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.id, member);
    }
    for (const contributor of contributorsQuery.data ?? []) {
      map.set(contributor.id, { id: contributor.id, name: contributor.name, email: contributor.email });
    }
    return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [contributorsQuery.data, membersQuery.data]);

  const usersById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    for (const user of usersDirectoryQuery.data?.users ?? []) {
      map.set(user.userId, { id: user.userId, name: user.name, email: user.email });
    }
    for (const person of reviewableUsers) {
      map.set(person.id, person);
    }
    return map;
  }, [reviewableUsers, usersDirectoryQuery.data?.users]);

  const approveMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${activityId}/approve`),
    onSuccess: async (updatedActivity) => {
      if (activeTenantId && submittedFilters.departmentId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.departmentActivities(activeTenantId, submittedFilters.departmentId, filterSignature)
        });
        await queryClient.invalidateQueries({
          queryKey: ["review-pending-activities", activeTenantId, submittedFilters.departmentId]
        });
      }
      setSelectedActivity(updatedActivity);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { activityId: string; reason: string }) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${input.activityId}/reject`, {
        body: { reason: input.reason }
      }),
    onSuccess: async (updatedActivity) => {
      if (activeTenantId && submittedFilters.departmentId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.departmentActivities(activeTenantId, submittedFilters.departmentId, filterSignature)
        });
        await queryClient.invalidateQueries({
          queryKey: ["review-pending-activities", activeTenantId, submittedFilters.departmentId]
        });
      }
      setSelectedActivity(updatedActivity);
    }
  });

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  function openFiltersModal() {
    setFilterDraft(submittedFilters);
    setIsFilterModalOpen(true);
  }

  function clearFilterDraft() {
    const fallbackDepartmentId = managedDepartments[0]?.id ?? "";
    setFilterDraft(createDefaultFilters(fallbackDepartmentId));
  }

  function resetAppliedFilters() {
    const fallbackDepartmentId = managedDepartments[0]?.id ?? "";
    const nextDefaults = createDefaultFilters(fallbackDepartmentId);
    setSubmittedFilters(nextDefaults);
    setFilterDraft(nextDefaults);
    setSelectedActivity(null);
  }

  function setDraftPresetToToday() {
    const todayValue = localDateValue();
    setFilterDraft((current) => ({
      ...current,
      dateMode: "single",
      dateFrom: todayValue,
      dateTo: todayValue
    }));
  }

  function setDraftPresetToWeek() {
    const now = new Date();
    const start = localDateValue(startOfWeek(now));
    const end = localDateValue(addDays(startOfWeek(now), 6));
    setFilterDraft((current) => ({
      ...current,
      dateMode: "range",
      dateFrom: start,
      dateTo: end
    }));
  }

  function setDraftPresetToMonth() {
    const now = new Date();
    const start = localDateValue(startOfMonth(now));
    const end = localDateValue(now);
    setFilterDraft((current) => ({
      ...current,
      dateMode: "range",
      dateFrom: start,
      dateTo: end
    }));
  }

  const activeFilterCount = [
    submittedFilters.status !== "pending" ? submittedFilters.status : "",
    submittedFilters.userId,
    submittedFilters.taskTemplateId,
    submittedFilters.dateFrom,
    submittedFilters.dateTo
  ].filter(Boolean).length;

  const appliedFilterLabels: string[] = [];
  if (submittedFilters.departmentId) {
    appliedFilterLabels.push(
      `Department: ${departmentNameById.get(submittedFilters.departmentId) ?? "Unknown department"}`
    );
  }
  appliedFilterLabels.push(
    `Status: ${
      submittedFilters.status === "pending"
        ? "Pending Review"
        : submittedFilters.status || "All"
    }`
  );
  if (submittedFilters.userId) {
    const user = reviewableUsers.find((entry) => entry.id === submittedFilters.userId);
    appliedFilterLabels.push(
      `User: ${user ? `${user.name} (${user.email})` : submittedFilters.userId}`
    );
  }
  if (submittedFilters.taskTemplateId) {
    const task = (departmentTasksQuery.data ?? []).find(
      (taskTemplate) => taskTemplate.id === submittedFilters.taskTemplateId
    );
    appliedFilterLabels.push(`Task: ${task?.name ?? submittedFilters.taskTemplateId}`);
  }
  if (submittedFilters.dateFrom && submittedFilters.dateMode === "single") {
    appliedFilterLabels.push(`Date: ${formatDateLabel(submittedFilters.dateFrom)}`);
  }
  if (submittedFilters.dateFrom && submittedFilters.dateMode === "range") {
    appliedFilterLabels.push(
      `Date: ${formatDateLabel(submittedFilters.dateFrom)} to ${formatDateLabel(submittedFilters.dateTo)}`
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title="Review Queue"
            subtitle="Review submitted/resubmitted logs for your managed departments."
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={openFiltersModal}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <Button variant="ghost" onClick={resetAppliedFilters}>
              Reset
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {appliedFilterLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-brand-mist bg-brand-mist/30 px-3 py-1 text-xs font-semibold text-brand-slate"
            >
              {label}
            </span>
          ))}
        </div>
      </Card>

      {submittedFilters.departmentId ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Members Awaiting Assessment"
              subtitle="Department members with submitted/resubmitted logs not yet assessed."
            />
            {membersQuery.isLoading || pendingActivitiesQuery.isLoading ? (
              <p className="text-sm text-brand-moss">Loading pending members...</p>
            ) : null}
            {membersQuery.error || pendingActivitiesQuery.error ? (
              <p className="text-sm text-red-700">
                {membersQuery.error instanceof Error
                  ? membersQuery.error.message
                  : pendingActivitiesQuery.error instanceof Error
                    ? pendingActivitiesQuery.error.message
                    : "Failed to load pending members."}
              </p>
            ) : null}
            {pendingMembers.length ? (
              <ul className="space-y-2 text-sm">
                {pendingMembers.map((member) => (
                  <li key={member.id} className="rounded-lg border border-brand-mist/60 bg-white p-2">
                    <button
                      type="button"
                      className="font-semibold text-brand-slate hover:text-[#1d4ed8] hover:underline"
                      onClick={() => router.push(tenantRoutes.userDetail(activeTenantId, member.id))}
                    >
                      {member.name}
                    </button>
                    <p className="text-xs text-brand-moss">{member.email}</p>
                    <p className="text-xs text-brand-moss">
                      Pending logs: {member.pendingCount} | Latest: {formatDate(member.latestPendingAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : !membersQuery.isLoading && !pendingActivitiesQuery.isLoading && !membersQuery.error ? (
              <p className="text-sm text-brand-moss">No pending logs for department members.</p>
            ) : null}
          </Card>

          <Card>
            <SectionTitle
              title="Contributors Awaiting Assessment"
              subtitle="Contributors with submitted/resubmitted logs not yet assessed."
            />
            {contributorsQuery.isLoading || pendingActivitiesQuery.isLoading ? (
              <p className="text-sm text-brand-moss">Loading pending contributors...</p>
            ) : null}
            {contributorsQuery.error || pendingActivitiesQuery.error ? (
              <p className="text-sm text-red-700">
                {contributorsQuery.error instanceof Error
                  ? contributorsQuery.error.message
                  : pendingActivitiesQuery.error instanceof Error
                    ? pendingActivitiesQuery.error.message
                    : "Failed to load pending contributors."}
              </p>
            ) : null}
            {pendingContributors.length ? (
              <ul className="space-y-2 text-sm">
                {pendingContributors.map((contributor) => (
                  <li key={contributor.id} className="rounded-lg border border-brand-mist/60 bg-white p-2">
                    <button
                      type="button"
                      className="font-semibold text-brand-slate hover:text-[#1d4ed8] hover:underline"
                      onClick={() => router.push(tenantRoutes.userDetail(activeTenantId, contributor.id))}
                    >
                      {contributor.name}
                    </button>
                    <p className="text-xs text-brand-moss">{contributor.email}</p>
                    <p className="text-xs text-brand-moss">
                      Pending logs: {contributor.pendingCount} | Latest: {formatDate(contributor.latestPendingAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : !contributorsQuery.isLoading && !pendingActivitiesQuery.isLoading && !contributorsQuery.error ? (
              <p className="text-sm text-brand-moss">No pending logs for contributors.</p>
            ) : null}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-brand-moss">
            No managed departments available for review.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionTitle title="Submitted Logs" />
          {activitiesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading review queue...</p> : null}
          {activitiesQuery.error ? (
            <p className="text-sm text-red-700">
              {activitiesQuery.error instanceof Error
                ? activitiesQuery.error.message
                : "Failed to load review queue."}
            </p>
          ) : null}
          <ReviewTable
            activities={activitiesQuery.data ?? []}
            selectedActivityId={selectedActivity?.id}
            onSelect={setSelectedActivity}
            usersById={usersById}
          />
        </Card>

        <ActivityDetailDrawer
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          actions={
            selectedActivity ? (
              <ApproveRejectActions
                disabled={!["submitted", "resubmitted"].includes(selectedActivity.status)}
                onApprove={() => approveMutation.mutateAsync(selectedActivity.id).then(() => undefined)}
                onReject={(reason) =>
                  rejectMutation
                    .mutateAsync({ activityId: selectedActivity.id, reason })
                    .then(() => undefined)
                }
              />
            ) : undefined
          }
        />
      </div>

      {isFilterModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4"
          onClick={() => setIsFilterModalOpen(false)}
        >
          <section
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                  Filters
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Filter by your managed department, status, user, task, and date.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIsFilterModalOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="hod-filter-department">Department</Label>
                  <Select
                    id="hod-filter-department"
                    value={filterDraft.departmentId}
                    onChange={(event) =>
                      setFilterDraft((state) => ({
                        ...state,
                        departmentId: event.target.value,
                        userId: "",
                        taskTemplateId: ""
                      }))
                    }
                  >
                    <option value="">Select department</option>
                    {managedDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hod-filter-status">Status</Label>
                  <Select
                    id="hod-filter-status"
                    value={filterDraft.status}
                    onChange={(event) =>
                      setFilterDraft((state) => ({
                        ...state,
                        status: event.target.value as ReviewStatusFilter
                      }))
                    }
                  >
                    <option value="pending">Pending review (submitted + resubmitted)</option>
                    <option value="">All statuses</option>
                    <option value="submitted">submitted</option>
                    <option value="resubmitted">resubmitted</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="draft">draft</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hod-filter-user">Member/Contributor</Label>
                  <Select
                    id="hod-filter-user"
                    value={filterDraft.userId}
                    onChange={(event) =>
                      setFilterDraft((state) => ({ ...state, userId: event.target.value }))
                    }
                  >
                    <option value="">All users</option>
                    {reviewableUsers.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.email})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hod-filter-task">Task</Label>
                  <Select
                    id="hod-filter-task"
                    value={filterDraft.taskTemplateId}
                    onChange={(event) =>
                      setFilterDraft((state) => ({ ...state, taskTemplateId: event.target.value }))
                    }
                  >
                    <option value="">All tasks</option>
                    {(departmentTasksQuery.data ?? []).map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-4">
                <Label htmlFor="hod-filter-date-mode">Date</Label>
                <Select
                  id="hod-filter-date-mode"
                  value={filterDraft.dateMode}
                  onChange={(event) =>
                    setFilterDraft((state) => {
                      const nextMode = event.target.value as DateFilterMode;
                      return {
                        ...state,
                        dateMode: nextMode,
                        dateTo: nextMode === "single" ? state.dateFrom : state.dateTo || state.dateFrom
                      };
                    })
                  }
                >
                  <option value="single">Single date</option>
                  <option value="range">Date range</option>
                </Select>

                <div className={`mt-3 grid gap-3 ${filterDraft.dateMode === "range" ? "md:grid-cols-2" : ""}`}>
                  <div>
                    <Label htmlFor="hod-filter-date-from">
                      {filterDraft.dateMode === "range" ? "Start date" : "Date"}
                    </Label>
                    <Input
                      id="hod-filter-date-from"
                      type="date"
                      value={filterDraft.dateFrom}
                      onChange={(event) =>
                        setFilterDraft((state) => ({
                          ...state,
                          dateFrom: event.target.value,
                          dateTo: state.dateMode === "single" ? event.target.value : state.dateTo
                        }))
                      }
                    />
                  </div>
                  {filterDraft.dateMode === "range" ? (
                    <div>
                      <Label htmlFor="hod-filter-date-to">End date</Label>
                      <Input
                        id="hod-filter-date-to"
                        type="date"
                        value={filterDraft.dateTo}
                        onChange={(event) =>
                          setFilterDraft((state) => ({ ...state, dateTo: event.target.value }))
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={setDraftPresetToToday}>
                    Today
                  </Button>
                  <Button variant="ghost" onClick={setDraftPresetToWeek}>
                    This Week
                  </Button>
                  <Button variant="ghost" onClick={setDraftPresetToMonth}>
                    This Month
                  </Button>
                </div>
                {draftDateRangeError ? (
                  <p className="mt-2 text-sm text-red-700">{draftDateRangeError}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={clearFilterDraft}>
                Clear
              </Button>
              <Button
                disabled={Boolean(draftDateRangeError) || !filterDraft.departmentId}
                onClick={() => {
                  if (draftDateRangeError || !filterDraft.departmentId) {
                    return;
                  }
                  setSubmittedFilters({ ...filterDraft });
                  setSelectedActivity(null);
                  setIsFilterModalOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
