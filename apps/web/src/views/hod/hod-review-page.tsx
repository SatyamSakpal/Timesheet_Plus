"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

const ALL_DEPARTMENTS_ID = "__all_departments__";
const ALL_DEPARTMENTS_LABEL = "All Departments";

function isReviewableStatus(status: ActivityEntry["status"]): boolean {
  return status === "submitted" || status === "resubmitted";
}

function createDefaultFilters(defaultDepartmentId: string): FilterState {
  const weekStart = localDateValue(startOfWeek(new Date()));
  const weekEnd = localDateValue(addDays(startOfWeek(new Date()), 6));
  return {
    departmentId: defaultDepartmentId,
    status: "pending",
    userId: "",
    taskTemplateId: "",
    dateMode: "range",
    dateFrom: weekStart,
    dateTo: weekEnd
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
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId } = useActiveTenant();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEntry | null>(null);
  const [submittedFilters, setSubmittedFilters] = useState<FilterState>(() => createDefaultFilters(""));
  const [filterDraft, setFilterDraft] = useState<FilterState>(() => createDefaultFilters(""));
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

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

  const managedDepartmentIds = useMemo(
    () => managedDepartments.map((department) => department.id),
    [managedDepartments]
  );
  const canUseAllDepartmentsFilter = managedDepartments.length > 1;
  const defaultDepartmentId = useMemo(
    () =>
      canUseAllDepartmentsFilter ? ALL_DEPARTMENTS_ID : (managedDepartments[0]?.id ?? ""),
    [canUseAllDepartmentsFilter, managedDepartments]
  );

  const managedDepartmentSignature = useMemo(
    () => [...managedDepartmentIds].sort().join(","),
    [managedDepartmentIds]
  );

  const selectedSubmittedDepartmentIds = useMemo(() => {
    if (canUseAllDepartmentsFilter && submittedFilters.departmentId === ALL_DEPARTMENTS_ID) {
      return managedDepartmentIds;
    }
    if (submittedFilters.departmentId && managedDepartmentIds.includes(submittedFilters.departmentId)) {
      return [submittedFilters.departmentId];
    }
    return [];
  }, [canUseAllDepartmentsFilter, managedDepartmentIds, submittedFilters.departmentId]);

  const selectedDraftDepartmentIds = useMemo(() => {
    if (canUseAllDepartmentsFilter && filterDraft.departmentId === ALL_DEPARTMENTS_ID) {
      return managedDepartmentIds;
    }
    if (filterDraft.departmentId && managedDepartmentIds.includes(filterDraft.departmentId)) {
      return [filterDraft.departmentId];
    }
    return [];
  }, [canUseAllDepartmentsFilter, filterDraft.departmentId, managedDepartmentIds]);

  const isAllDepartmentsSelected =
    canUseAllDepartmentsFilter && submittedFilters.departmentId === ALL_DEPARTMENTS_ID;

  useEffect(() => {
    if (managedDepartments.length === 0) {
      return;
    }
    const availableDepartmentIds = new Set(managedDepartments.map((department) => department.id));
    if (canUseAllDepartmentsFilter) {
      availableDepartmentIds.add(ALL_DEPARTMENTS_ID);
    }
    const fallbackDepartmentId = defaultDepartmentId;

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
  }, [canUseAllDepartmentsFilter, defaultDepartmentId, managedDepartments]);

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
      activeTenantId && selectedSubmittedDepartmentIds.length > 0
        ? queryKeys.departmentActivities(
            activeTenantId,
            submittedFilters.departmentId,
            `${filterSignature}:${managedDepartmentSignature}`
          )
        : ["hod-review", "none"],
    queryFn: async () => {
      const departmentIds = selectedSubmittedDepartmentIds;
      if (departmentIds.length === 0) {
        return [] as ActivityEntry[];
      }

      const baseQuery = {
        userId: submittedFilters.userId || undefined,
        taskTemplateId: submittedFilters.taskTemplateId || undefined,
        dateFrom: resolvedSubmittedDateRange.dateFrom,
        dateTo: resolvedSubmittedDateRange.dateTo
      };

      if (submittedFilters.status === "pending") {
        const [submittedBatches, resubmittedBatches] = await Promise.all([
          Promise.all(
            departmentIds.map((departmentId) =>
              apiClient.get<ActivityEntry[]>(
                `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`,
                { query: { ...baseQuery, status: "submitted" } }
              )
            )
          ),
          Promise.all(
            departmentIds.map((departmentId) =>
              apiClient.get<ActivityEntry[]>(
                `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`,
                { query: { ...baseQuery, status: "resubmitted" } }
              )
            )
          )
        ]);

        const submitted = submittedBatches.flat();
        const resubmitted = resubmittedBatches.flat();
        const map = new Map<string, ActivityEntry>();
        for (const activity of [...submitted, ...resubmitted]) {
          map.set(activity.id, activity);
        }
        return [...map.values()].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
      }

      const batches = await Promise.all(
        departmentIds.map((departmentId) =>
          apiClient.get<ActivityEntry[]>(
            `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`,
            {
              query: {
                ...baseQuery,
                status: submittedFilters.status || undefined
              }
            }
          )
        )
      );
      return batches
        .flat()
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
    },
    enabled: Boolean(activeTenantId && selectedSubmittedDepartmentIds.length > 0)
  });

  const membersQuery = useQuery({
    queryKey:
      activeTenantId && selectedSubmittedDepartmentIds.length > 0
        ? queryKeys.departmentMembers(
            activeTenantId,
            `${submittedFilters.departmentId}:${managedDepartmentSignature}`
          )
        : ["review-department-members", "none"],
    queryFn: async () => {
      const departmentIds = selectedSubmittedDepartmentIds;
      if (departmentIds.length === 0) {
        return [] as DepartmentPersonCompact[];
      }
      const batches = await Promise.all(
        departmentIds.map((departmentId) =>
          apiClient.get<DepartmentPersonCompact[]>(
            `/v1/tenants/${activeTenantId}/departments/${departmentId}/members`
          )
        )
      );
      const map = new Map<string, DepartmentPersonCompact>();
      for (const member of batches.flat()) {
        map.set(member.id, member);
      }
      return [...map.values()];
    },
    enabled: Boolean(activeTenantId && selectedSubmittedDepartmentIds.length > 0)
  });

  const contributorsQuery = useQuery({
    queryKey:
      activeTenantId && selectedSubmittedDepartmentIds.length > 0
        ? queryKeys.departmentContributors(
            activeTenantId,
            `${submittedFilters.departmentId}:${managedDepartmentSignature}`
          )
        : ["review-department-contributors", "none"],
    queryFn: async () => {
      const departmentIds = selectedSubmittedDepartmentIds;
      if (departmentIds.length === 0) {
        return [] as DepartmentContributorCompact[];
      }
      const batches = await Promise.all(
        departmentIds.map((departmentId) =>
          apiClient.get<DepartmentContributorCompact[]>(
            `/v1/tenants/${activeTenantId}/departments/${departmentId}/contributors`
          )
        )
      );
      const map = new Map<string, DepartmentContributorCompact>();
      for (const contributor of batches.flat()) {
        map.set(contributor.id, contributor);
      }
      return [...map.values()];
    },
    enabled: Boolean(activeTenantId && selectedSubmittedDepartmentIds.length > 0)
  });

  const pendingActivitiesQuery = useQuery({
    queryKey:
      activeTenantId && selectedSubmittedDepartmentIds.length > 0
        ? [
            "review-pending-activities",
            activeTenantId,
            submittedFilters.departmentId,
            managedDepartmentSignature
          ]
        : ["review-pending-activities", "none"],
    queryFn: async () => {
      const departmentIds = selectedSubmittedDepartmentIds;
      if (departmentIds.length === 0) {
        return [] as ActivityEntry[];
      }
      const [submittedBatches, resubmittedBatches] = await Promise.all([
        Promise.all(
          departmentIds.map((departmentId) =>
            apiClient.get<ActivityEntry[]>(
              `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`,
              { query: { status: "submitted" } }
            )
          )
        ),
        Promise.all(
          departmentIds.map((departmentId) =>
            apiClient.get<ActivityEntry[]>(
              `/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`,
              { query: { status: "resubmitted" } }
            )
          )
        )
      ]);
      const submitted = submittedBatches.flat();
      const resubmitted = resubmittedBatches.flat();
      return [...submitted, ...resubmitted];
    },
    enabled: Boolean(activeTenantId && selectedSubmittedDepartmentIds.length > 0)
  });

  const departmentTasksQuery = useQuery({
    queryKey:
      activeTenantId && selectedDraftDepartmentIds.length > 0
        ? queryKeys.departmentTasks(
            activeTenantId,
            `${filterDraft.departmentId}:${managedDepartmentSignature}`
          )
        : ["department-tasks", "none"],
    queryFn: async () => {
      const departmentIds = selectedDraftDepartmentIds;
      if (departmentIds.length === 0) {
        return [] as TaskTemplate[];
      }
      const batches = await Promise.all(
        departmentIds.map((departmentId) =>
          apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/departments/${departmentId}/tasks`)
        )
      );

      const map = new Map<string, TaskTemplate>();
      for (const task of batches.flat()) {
        const existing = map.get(task.id);
        if (!existing || task.version > existing.version) {
          map.set(task.id, task);
        }
      }
      return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
    },
    enabled: Boolean(activeTenantId && selectedDraftDepartmentIds.length > 0)
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

  const pendingAllContributors = useMemo<PendingUserRow[]>(() => {
    return reviewableUsers
      .filter((user) => pendingByUserId.has(user.id))
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        pendingCount: pendingByUserId.get(user.id)?.count ?? 0,
        latestPendingAt: pendingByUserId.get(user.id)?.latest ?? null
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [pendingByUserId, reviewableUsers]);

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

  const reviewQueueActivities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const selectableActivityIds = useMemo(
    () =>
      reviewQueueActivities
        .filter((activity) => isReviewableStatus(activity.status))
        .map((activity) => activity.id),
    [reviewQueueActivities]
  );

  const selectedSelectableActivityIds = useMemo(() => {
    const selectableIds = new Set(selectableActivityIds);
    return selectedActivityIds.filter((activityId) => selectableIds.has(activityId));
  }, [selectableActivityIds, selectedActivityIds]);

  useEffect(() => {
    const activityIds = new Set(reviewQueueActivities.map((activity) => activity.id));
    setSelectedActivityIds((current) => current.filter((activityId) => activityIds.has(activityId)));
  }, [reviewQueueActivities]);

  const approveMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${activityId}/approve`),
    onSuccess: async (updatedActivity) => {
      await invalidateReviewQueries();
      setSelectedActivity(updatedActivity);
      setSelectedActivityIds((current) => current.filter((activityId) => activityId !== updatedActivity.id));
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { activityId: string; reason: string }) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${input.activityId}/reject`, {
        body: { reason: input.reason }
      }),
    onSuccess: async (updatedActivity) => {
      await invalidateReviewQueries();
      setSelectedActivity(updatedActivity);
      setSelectedActivityIds((current) => current.filter((activityId) => activityId !== updatedActivity.id));
    }
  });

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  function openFiltersModal() {
    setFilterDraft(submittedFilters);
    setIsFilterModalOpen(true);
  }

  async function invalidateReviewQueries() {
    if (!activeTenantId || !submittedFilters.departmentId) {
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.departmentActivities(
        activeTenantId,
        submittedFilters.departmentId,
        `${filterSignature}:${managedDepartmentSignature}`
      )
    });
    await queryClient.invalidateQueries({
      queryKey: [
        "review-pending-activities",
        activeTenantId,
        submittedFilters.departmentId,
        managedDepartmentSignature
      ]
    });
  }

  function clearFilterDraft() {
    const fallbackDepartmentId = defaultDepartmentId;
    setFilterDraft(createDefaultFilters(fallbackDepartmentId));
  }

  function resetAppliedFilters() {
    const fallbackDepartmentId = defaultDepartmentId;
    const nextDefaults = createDefaultFilters(fallbackDepartmentId);
    setSubmittedFilters(nextDefaults);
    setFilterDraft(nextDefaults);
    setSelectedActivity(null);
    setSelectedActivityIds([]);
    setIsSelectionMode(false);
    setBulkActionError(null);
    setIsBulkRejectModalOpen(false);
    setBulkRejectReason("");
  }

  function applyUserFilter(userId: string) {
    setSubmittedFilters((current) => ({
      ...current,
      userId
    }));
    setFilterDraft((current) => ({
      ...current,
      userId
    }));
    setSelectedActivity(null);
    setSelectedActivityIds([]);
    setIsSelectionMode(false);
  }

  function clearUserFilter() {
    setSubmittedFilters((current) => ({
      ...current,
      userId: ""
    }));
    setFilterDraft((current) => ({
      ...current,
      userId: ""
    }));
    setSelectedActivity(null);
    setSelectedActivityIds([]);
    setIsSelectionMode(false);
  }

  function toggleActivitySelection(activityId: string) {
    setSelectedActivityIds((current) => {
      if (current.includes(activityId)) {
        return current.filter((entryId) => entryId !== activityId);
      }
      return [...current, activityId];
    });
  }

  function toggleSelectAllActivities() {
    const selectableIds = new Set(selectableActivityIds);
    const selectedCount = selectedActivityIds.filter((activityId) => selectableIds.has(activityId)).length;
    if (selectedCount === selectableActivityIds.length && selectableActivityIds.length > 0) {
      setSelectedActivityIds((current) => current.filter((activityId) => !selectableIds.has(activityId)));
      return;
    }
    setSelectedActivityIds((current) => {
      const merged = new Set(current);
      for (const activityId of selectableActivityIds) {
        merged.add(activityId);
      }
      return [...merged];
    });
  }

  async function runBulkReviewAction(action: "approve" | "reject", reason?: string) {
    if (!activeTenantId || selectedSelectableActivityIds.length === 0 || isBulkActionRunning) {
      return;
    }
    try {
      setBulkActionError(null);
      setIsBulkActionRunning(true);
      if (action === "approve") {
        await Promise.all(
          selectedSelectableActivityIds.map((activityId) =>
            apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${activityId}/approve`)
          )
        );
      } else {
        const trimmedReason = (reason ?? "").trim();
        if (trimmedReason.length < 3) {
          throw new Error("Reject reason must be at least 3 characters.");
        }
        await Promise.all(
          selectedSelectableActivityIds.map((activityId) =>
            apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${activityId}/reject`, {
              body: { reason: trimmedReason }
            })
          )
        );
      }
      await invalidateReviewQueries();
      setSelectedActivityIds([]);
      setSelectedActivity(null);
      setIsSelectionMode(false);
      setIsBulkRejectModalOpen(false);
      setBulkRejectReason("");
    } catch (nextError) {
      setBulkActionError(nextError instanceof Error ? nextError.message : "Bulk action failed.");
    } finally {
      setIsBulkActionRunning(false);
    }
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
    const departmentLabel =
      submittedFilters.departmentId === ALL_DEPARTMENTS_ID
        ? ALL_DEPARTMENTS_LABEL
        : departmentNameById.get(submittedFilters.departmentId) ?? "Unknown department";
    appliedFilterLabels.push(
      `Department: ${departmentLabel}`
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

  const selectedUser = submittedFilters.userId ? usersById.get(submittedFilters.userId) : null;
  const selectedActivityOwner = selectedActivity ? usersById.get(selectedActivity.userId) : null;
  const selectedActivityDepartmentName = selectedActivity
    ? departmentNameById.get(selectedActivity.workDepartmentId) ?? "Unknown department"
    : "Unknown department";

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="max-h-[72vh] overflow-y-auto">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  className="text-xl font-semibold text-brand-slate"
                  style={{ fontFamily: "var(--font-heading), sans-serif" }}
                >
                  Submitted Logs
                </h3>
                <p className="mt-1 text-sm text-brand-moss">
                  {isSelectionMode
                    ? "Selection mode enabled. Click rows to select logs."
                    : "Click any row to open activity details."}
                </p>
              </div>
              <Button
                variant={isSelectionMode ? "secondary" : "ghost"}
                onClick={() => {
                  const nextMode = !isSelectionMode;
                  setIsSelectionMode(nextMode);
                  setBulkActionError(null);
                  if (nextMode) {
                    setSelectedActivity(null);
                    return;
                  }
                  setSelectedActivityIds([]);
                  setIsBulkRejectModalOpen(false);
                  setBulkRejectReason("");
                }}
              >
                {isSelectionMode ? "Done Selecting" : "Select"}
              </Button>
            </div>
            {isSelectionMode && selectedSelectableActivityIds.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2">
                <p className="text-sm font-semibold text-[#1e3a8a]">
                  {selectedSelectableActivityIds.length} selected
                </p>
                <Button
                  variant="ghost"
                  disabled={isBulkActionRunning}
                  onClick={() => void runBulkReviewAction("approve")}
                >
                  {isBulkActionRunning ? "Processing..." : "Approve Selected"}
                </Button>
                <Button
                  variant="danger"
                  disabled={isBulkActionRunning}
                  onClick={() => {
                    setBulkActionError(null);
                    setBulkRejectReason("");
                    setIsBulkRejectModalOpen(true);
                  }}
                >
                  Reject Selected
                </Button>
                <Button
                  variant="ghost"
                  disabled={isBulkActionRunning}
                  onClick={() => setSelectedActivityIds([])}
                >
                  Clear Selection
                </Button>
              </div>
            ) : null}
            {submittedFilters.userId ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2">
                <p className="text-sm font-semibold text-[#1e3a8a]">
                  Showing logs for: {selectedUser ? selectedUser.name : "Selected user"}
                </p>
                {selectedUser ? <p className="text-xs text-[#1e40af]">{selectedUser.email}</p> : null}
                <Button variant="ghost" onClick={clearUserFilter}>
                  Clear User Filter
                </Button>
              </div>
            ) : null}
            {activitiesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading review queue...</p> : null}
            {activitiesQuery.error ? (
              <p className="text-sm text-red-700">
                {activitiesQuery.error instanceof Error
                  ? activitiesQuery.error.message
                  : "Failed to load review queue."}
              </p>
            ) : null}
            {bulkActionError ? <p className="mt-2 text-sm text-red-700">{bulkActionError}</p> : null}
            <ReviewTable
              activities={reviewQueueActivities}
              selectedActivityId={isSelectionMode ? undefined : selectedActivity?.id}
              onSelect={setSelectedActivity}
              usersById={usersById}
              departmentNameById={departmentNameById}
              selectedActivityIds={selectedActivityIds}
              selectableActivityIds={selectableActivityIds}
              onToggleActivitySelection={toggleActivitySelection}
              onToggleSelectAllActivities={toggleSelectAllActivities}
              selectionMode={isSelectionMode}
            />
          </Card>

          <Card className="max-h-[72vh] overflow-y-auto">
            <SectionTitle
              title="People Awaiting Assessment"
              subtitle={
                isAllDepartmentsSelected
                  ? "Contributors with pending logs across all managed departments. Click a card to filter logs."
                  : "Members and contributors with pending logs. Click a card to filter logs."
              }
            />
            {membersQuery.isLoading || contributorsQuery.isLoading || pendingActivitiesQuery.isLoading ? (
              <p className="text-sm text-brand-moss">Loading people summary...</p>
            ) : null}
            {membersQuery.error || contributorsQuery.error || pendingActivitiesQuery.error ? (
              <p className="text-sm text-red-700">
                {membersQuery.error instanceof Error
                  ? membersQuery.error.message
                  : contributorsQuery.error instanceof Error
                    ? contributorsQuery.error.message
                    : pendingActivitiesQuery.error instanceof Error
                      ? pendingActivitiesQuery.error.message
                      : "Failed to load people summary."}
              </p>
            ) : null}

            <div className="space-y-4">
              {isAllDepartmentsSelected ? (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">
                    Contributors
                  </h3>
                  {pendingAllContributors.length ? (
                    <ul className="mt-2 space-y-2">
                      {pendingAllContributors.map((contributor) => (
                        <li key={contributor.id}>
                          <button
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                              submittedFilters.userId === contributor.id
                                ? "border-[#3b82f6] bg-[#eff6ff]"
                                : "border-brand-mist/60 bg-[#f8fafc] hover:border-[#93c5fd]"
                            }`}
                            onClick={() => applyUserFilter(contributor.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-brand-slate">{contributor.name}</p>
                                <p className="text-xs text-brand-moss">{contributor.email}</p>
                              </div>
                              <span className="rounded-full bg-brand-mist/40 px-2 py-1 text-[11px] font-semibold text-brand-slate">
                                {contributor.pendingCount}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-brand-moss">
                              Latest: {formatDate(contributor.latestPendingAt)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : !contributorsQuery.isLoading && !pendingActivitiesQuery.isLoading && !contributorsQuery.error ? (
                    <p className="mt-2 text-sm text-brand-moss">No pending logs for contributors.</p>
                  ) : null}
                </section>
              ) : (
                <>
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">
                      Members
                    </h3>
                    {pendingMembers.length ? (
                      <ul className="mt-2 space-y-2">
                        {pendingMembers.map((member) => (
                          <li key={member.id}>
                            <button
                              type="button"
                              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                submittedFilters.userId === member.id
                                  ? "border-[#3b82f6] bg-[#eff6ff]"
                                  : "border-brand-mist/60 bg-[#f8fafc] hover:border-[#93c5fd]"
                              }`}
                              onClick={() => applyUserFilter(member.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-brand-slate">{member.name}</p>
                                  <p className="text-xs text-brand-moss">{member.email}</p>
                                </div>
                                <span className="rounded-full bg-brand-mist/40 px-2 py-1 text-[11px] font-semibold text-brand-slate">
                                  {member.pendingCount}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-brand-moss">
                                Latest: {formatDate(member.latestPendingAt)}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : !membersQuery.isLoading && !pendingActivitiesQuery.isLoading && !membersQuery.error ? (
                      <p className="mt-2 text-sm text-brand-moss">No pending logs for members.</p>
                    ) : null}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">
                      Contributors
                    </h3>
                    {pendingContributors.length ? (
                      <ul className="mt-2 space-y-2">
                        {pendingContributors.map((contributor) => (
                          <li key={contributor.id}>
                            <button
                              type="button"
                              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                submittedFilters.userId === contributor.id
                                  ? "border-[#3b82f6] bg-[#eff6ff]"
                                  : "border-brand-mist/60 bg-[#f8fafc] hover:border-[#93c5fd]"
                              }`}
                              onClick={() => applyUserFilter(contributor.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-brand-slate">{contributor.name}</p>
                                  <p className="text-xs text-brand-moss">{contributor.email}</p>
                                </div>
                                <span className="rounded-full bg-brand-mist/40 px-2 py-1 text-[11px] font-semibold text-brand-slate">
                                  {contributor.pendingCount}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-brand-moss">
                                Latest: {formatDate(contributor.latestPendingAt)}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : !contributorsQuery.isLoading && !pendingActivitiesQuery.isLoading && !contributorsQuery.error ? (
                      <p className="mt-2 text-sm text-brand-moss">No pending logs for contributors.</p>
                    ) : null}
                  </section>
                </>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-brand-moss">
            No managed departments available for review.
          </p>
        </Card>
      )}

      {isBulkRejectModalOpen ? (
        <ModalOverlay
          onClose={() => {
            if (isBulkActionRunning) {
              return;
            }
            setIsBulkRejectModalOpen(false);
            setBulkRejectReason("");
            setBulkActionError(null);
          }}
        >
          <section
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[90vh] overflow-y-auto p-6 [scrollbar-gutter:stable]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                    Reject Selected Logs
                  </h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Reject {selectedSelectableActivityIds.length} selected log(s) with one reason.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  disabled={isBulkActionRunning}
                  onClick={() => {
                    setIsBulkRejectModalOpen(false);
                    setBulkRejectReason("");
                    setBulkActionError(null);
                  }}
                >
                  Close
                </Button>
              </div>

              <div className="mt-4">
                <Label htmlFor="bulk-reject-reason">Reject Reason</Label>
                <Input
                  id="bulk-reject-reason"
                  value={bulkRejectReason}
                  onChange={(event) => setBulkRejectReason(event.target.value)}
                  placeholder="Reason shown to contributors"
                  disabled={isBulkActionRunning}
                />
              </div>

              {bulkActionError ? <p className="mt-3 text-sm text-red-700">{bulkActionError}</p> : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={isBulkActionRunning}
                  onClick={() => {
                    setIsBulkRejectModalOpen(false);
                    setBulkRejectReason("");
                    setBulkActionError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={isBulkActionRunning || selectedSelectableActivityIds.length === 0}
                  onClick={() => void runBulkReviewAction("reject", bulkRejectReason)}
                >
                  {isBulkActionRunning ? "Rejecting..." : "Reject Selected"}
                </Button>
              </div>
            </div>
          </section>
        </ModalOverlay>
      ) : null}

      {selectedActivity ? (
        <ModalOverlay onClose={() => setSelectedActivity(null)}>
          <section
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white p-0 shadow-[0_20px_60px_rgba(15,23,42,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[90vh] overflow-y-auto [scrollbar-gutter:stable]">
              <ActivityDetailDrawer
                activity={selectedActivity}
                onClose={() => setSelectedActivity(null)}
                ownerName={selectedActivityOwner?.name}
                ownerEmail={selectedActivityOwner?.email}
                departmentName={selectedActivityDepartmentName}
                variant="plain"
                showCloseButton={false}
                actions={
                  <ApproveRejectActions
                    disabled={!["submitted", "resubmitted"].includes(selectedActivity.status)}
                    onApprove={() => approveMutation.mutateAsync(selectedActivity.id).then(() => undefined)}
                    onReject={(reason) =>
                      rejectMutation
                        .mutateAsync({ activityId: selectedActivity.id, reason })
                        .then(() => undefined)
                    }
                  />
                }
              />
            </div>
          </section>
        </ModalOverlay>
      ) : null}

      {isFilterModalOpen ? (
        <ModalOverlay onClose={() => setIsFilterModalOpen(false)}>
          <section
            className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[90vh] overflow-y-auto p-6 [scrollbar-gutter:stable]">
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
                    <SearchableSelect
                      id="hod-filter-department"
                      value={filterDraft.departmentId}
                      onChange={(nextDepartmentId) =>
                        setFilterDraft((state) => ({
                          ...state,
                          departmentId: nextDepartmentId,
                          userId: "",
                          taskTemplateId: ""
                        }))
                      }
                      placeholder="Select department"
                      options={[
                        { value: "", label: "Select department" },
                        ...(canUseAllDepartmentsFilter
                          ? [{ value: ALL_DEPARTMENTS_ID, label: ALL_DEPARTMENTS_LABEL }]
                          : []),
                        ...managedDepartments.map((department) => ({
                          value: department.id,
                          label: department.name
                        }))
                      ]}
                    />
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
                    <SearchableSelect
                      id="hod-filter-user"
                      value={filterDraft.userId}
                      onChange={(nextUserId) =>
                        setFilterDraft((state) => ({ ...state, userId: nextUserId }))
                      }
                      placeholder="All users"
                      options={[
                        { value: "", label: "All users" },
                        ...reviewableUsers.map((person) => ({
                          value: person.id,
                          label: `${person.name} (${person.email})`
                        }))
                      ]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hod-filter-task">Task</Label>
                    <SearchableSelect
                      id="hod-filter-task"
                      value={filterDraft.taskTemplateId}
                      onChange={(nextTaskTemplateId) =>
                        setFilterDraft((state) => ({ ...state, taskTemplateId: nextTaskTemplateId }))
                      }
                      placeholder="All tasks"
                      options={[
                        { value: "", label: "All tasks" },
                        ...(departmentTasksQuery.data ?? []).map((task) => ({
                          value: task.id,
                          label: task.name
                        }))
                      ]}
                    />
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
                  setSelectedActivityIds([]);
                  setIsSelectionMode(false);
                  setBulkActionError(null);
                  setIsFilterModalOpen(false);
                }}
              >
                  Apply Filters
                </Button>
              </div>
            </div>
          </section>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
