"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { ACTIVITY_STATUSES } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import type { ActivityEntry, DepartmentEntity, TaskTemplate } from "@/lib/types";
import { DynamicFieldRenderer } from "@/components/activity/dynamic-field-renderer";
import { TaskTemplateSelect } from "@/components/activity/task-template-select";
import { ValidationSummary } from "@/components/activity/validation-summary";
import { TenantRequired } from "@/components/layout/tenant-required";
import {
  Badge,
  Button,
  Card,
  InlineError,
  Input,
  Label,
  SectionTitle,
  Select
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

type DateFilterMode = "single" | "range";

interface ActivityFilters {
  dateMode: DateFilterMode;
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  status: "" | ActivityEntry["status"];
  taskTemplateId: string;
  keyword: string;
}

function toneByStatus(status: ActivityEntry["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "approved") {
    return "success";
  }
  if (status === "rejected") {
    return "danger";
  }
  if (status === "resubmitted") {
    return "info";
  }
  if (status === "submitted") {
    return "warning";
  }
  return "neutral";
}

function localDateValue(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function parseTimeToMinutes(value: string): number | null {
  if (!value || !value.includes(":")) {
    return null;
  }
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function getActivityDurationMinutes(activity: ActivityEntry): number {
  const start = parseTimeToMinutes(activity.startTime);
  const end = parseTimeToMinutes(activity.endTime);
  if (start === null || end === null || end <= start) {
    return 0;
  }
  return end - start;
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hoursPart = Math.floor(safeMinutes / 60);
  const minutesPart = safeMinutes % 60;
  if (hoursPart === 0) {
    return `${minutesPart}m`;
  }
  if (minutesPart === 0) {
    return `${hoursPart}h`;
  }
  return `${hoursPart}h ${minutesPart}m`;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

function formatPercentTrend(current: number, previous: number): { label: string; positive: boolean } {
  if (previous === 0) {
    if (current === 0) {
      return { label: "0%", positive: true };
    }
    return { label: "+100%", positive: true };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    label: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    positive: change >= 0
  };
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

function createDefaultFilters(today: string): ActivityFilters {
  return {
    dateMode: "single",
    dateFrom: today,
    dateTo: today,
    departmentId: "",
    status: "",
    taskTemplateId: "",
    keyword: ""
  };
}

function humanizeKey(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return `${value}`;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Not provided";
    }
    return value.map((item) => formatPayloadValue(item)).join(", ");
  }
  if (typeof value === "object") {
    const objectEntries = Object.entries(value as Record<string, unknown>);
    if (objectEntries.length === 0) {
      return "Not provided";
    }
    return objectEntries
      .map(([key, nestedValue]) => `${humanizeKey(key)}: ${formatPayloadValue(nestedValue)}`)
      .join("; ");
  }
  return String(value);
}

export default function MyActivityPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const today = localDateValue();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEntry | null>(null);

  const [filters, setFilters] = useState<ActivityFilters>(() => createDefaultFilters(today));
  const [filterDraft, setFilterDraft] = useState<ActivityFilters>(() => createDefaultFilters(today));

  const [logDepartmentId, setLogDepartmentId] = useState("");
  const [logTaskTemplateId, setLogTaskTemplateId] = useState("");
  const [logPayload, setLogPayload] = useState<Record<string, unknown>>({});
  const [activityDate, setActivityDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [logError, setLogError] = useState<string | null>(null);

  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [resubmitPayload, setResubmitPayload] = useState<Record<string, unknown>>({});

  const activitiesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.myActivities(activeTenantId) : ["my-activities", "none"],
    queryFn: () => apiClient.get<ActivityEntry[]>(`/v1/tenants/${activeTenantId}/activities/my`),
    enabled: Boolean(activeTenantId)
  });

  const departmentsQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantDepartments(activeTenantId) : ["tenant-departments", "none"],
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${activeTenantId}/departments`),
    enabled: Boolean(activeTenantId)
  });

  const departmentNameById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((department) => [department.id, department.name])),
    [departmentsQuery.data]
  );

  const formatDepartment = (departmentId: string) =>
    departmentNameById.get(departmentId) ?? "Unknown department";

  const tasksQuery = useQuery({
    queryKey:
      activeTenantId && logDepartmentId
        ? queryKeys.departmentTasks(activeTenantId, logDepartmentId)
        : ["department-tasks", "none"],
    queryFn: () =>
      apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/departments/${logDepartmentId}/tasks`),
    enabled: Boolean(activeTenantId && logDepartmentId)
  });

  const allActivities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);

  const selectedTemplate = useMemo(
    () => tasksQuery.data?.find((template) => template.id === logTaskTemplateId) ?? null,
    [tasksQuery.data, logTaskTemplateId]
  );

  const activityTemplateOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const activity of allActivities) {
      if (!map.has(activity.taskTemplateId)) {
        map.set(activity.taskTemplateId, activity.taskTemplateName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [allActivities]);

  const activityTemplateNameById = useMemo(
    () => new Map(activityTemplateOptions.map((option) => [option.id, option.name])),
    [activityTemplateOptions]
  );

  const dateRangeError = useMemo(() => {
    if (filters.dateMode !== "range") {
      return null;
    }
    if (!filters.dateFrom || !filters.dateTo) {
      return "Start and end dates are required for a range.";
    }
    if (filters.dateTo < filters.dateFrom) {
      return "End date must be on or after start date.";
    }
    return null;
  }, [filters.dateFrom, filters.dateMode, filters.dateTo]);

  const filterDraftDateRangeError = useMemo(() => {
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

  const filteredActivities = useMemo(() => {
    if (dateRangeError) {
      return [] as ActivityEntry[];
    }

    const keyword = filters.keyword.trim().toLowerCase();
    const effectiveDateTo = filters.dateMode === "single" ? filters.dateFrom : filters.dateTo;

    return [...allActivities]
      .filter((activity) => !filters.dateFrom || activity.activityDate >= filters.dateFrom)
      .filter((activity) => !effectiveDateTo || activity.activityDate <= effectiveDateTo)
      .filter((activity) => !filters.departmentId || activity.workDepartmentId === filters.departmentId)
      .filter((activity) => !filters.status || activity.status === filters.status)
      .filter((activity) => !filters.taskTemplateId || activity.taskTemplateId === filters.taskTemplateId)
      .filter((activity) => {
        if (!keyword) {
          return true;
        }
        const source = `${activity.taskTemplateName} ${activity.rejectionReason ?? ""}`.toLowerCase();
        return source.includes(keyword);
      })
      .sort((left, right) => {
        if (left.activityDate === right.activityDate) {
          if (left.startTime === right.startTime) {
            return left.createdAt < right.createdAt ? 1 : -1;
          }
          return left.startTime < right.startTime ? 1 : -1;
        }
        return left.activityDate < right.activityDate ? 1 : -1;
      });
  }, [allActivities, dateRangeError, filters]);

  const performanceStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = addDays(weekStart, 6);
    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = addDays(weekStart, -1);

    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(addDays(monthStart, -1));
    const prevMonthEnd = addDays(monthStart, -1);

    const weekStartKey = localDateValue(weekStart);
    const weekEndKey = localDateValue(weekEnd);
    const prevWeekStartKey = localDateValue(prevWeekStart);
    const prevWeekEndKey = localDateValue(prevWeekEnd);

    const monthStartKey = localDateValue(monthStart);
    const monthEndKey = localDateValue(now);
    const prevMonthStartKey = localDateValue(prevMonthStart);
    const prevMonthEndKey = localDateValue(prevMonthEnd);

    const rangeMetrics = (startKey: string, endKey: string) => {
      const entries = allActivities.filter(
        (activity) => activity.activityDate >= startKey && activity.activityDate <= endKey
      );
      const totalMinutes = entries.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);
      return {
        entries,
        totalMinutes
      };
    };

    const week = rangeMetrics(weekStartKey, weekEndKey);
    const previousWeek = rangeMetrics(prevWeekStartKey, prevWeekEndKey);
    const month = rangeMetrics(monthStartKey, monthEndKey);
    const previousMonth = rangeMetrics(prevMonthStartKey, prevMonthEndKey);

    const weekTrend = formatPercentTrend(week.totalMinutes, previousWeek.totalMinutes);
    const monthTrend = formatPercentTrend(month.totalMinutes, previousMonth.totalMinutes);
    const weekEntryTrend = formatPercentTrend(week.entries.length, previousWeek.entries.length);

    const reviewedEntries = allActivities.filter(
      (activity) => activity.status === "approved" || activity.status === "rejected"
    );
    const approvedEntries = reviewedEntries.filter((activity) => activity.status === "approved");
    const approvalRate =
      reviewedEntries.length > 0
        ? `${Math.round((approvedEntries.length / reviewedEntries.length) * 100)}%`
        : "N/A";

    return {
      weekMinutes: week.totalMinutes,
      monthMinutes: month.totalMinutes,
      weekEntries: week.entries.length,
      approvalRate,
      weekTrend,
      monthTrend,
      weekEntryTrend
    };
  }, [allActivities]);

  const overlapWarnings = useMemo(() => {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (!activityDate || start === null || end === null || end <= start) {
      return [] as ActivityEntry[];
    }

    return allActivities
      .filter((activity) => activity.activityDate === activityDate)
      .filter((activity) => activity.status !== "rejected")
      .filter((activity) => {
        const existingStart = parseTimeToMinutes(activity.startTime);
        const existingEnd = parseTimeToMinutes(activity.endTime);
        if (existingStart === null || existingEnd === null || existingEnd <= existingStart) {
          return false;
        }
        return rangesOverlap(start, end, existingStart, existingEnd);
      })
      .sort((left, right) => (left.startTime < right.startTime ? -1 : 1));
  }, [activityDate, allActivities, endTime, startTime]);

  const logValidationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!activityDate) {
      issues.push("Activity date is required.");
    }
    if (!startTime) {
      issues.push("Start time is required.");
    }
    if (!endTime) {
      issues.push("End time is required.");
    }
    if (startTime && endTime && endTime <= startTime) {
      issues.push("End time must be later than start time.");
    }
    if (overlapWarnings.length > 0) {
      const firstOverlap = overlapWarnings[0];
      issues.push(
        `Time range overlaps with "${firstOverlap.taskTemplateName}" (${firstOverlap.startTime}-${firstOverlap.endTime}) on ${activityDate}.`
      );
    }

    if (!selectedTemplate) {
      return issues;
    }

    for (const field of selectedTemplate.fields) {
      if (!field.required) {
        continue;
      }
      const value = logPayload[field.key];
      if (value === undefined || value === null || value === "") {
        issues.push(`"${field.label}" is required.`);
      }
    }

    return issues;
  }, [activityDate, endTime, logPayload, overlapWarnings, selectedTemplate, startTime]);

  const createActivityMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities`, {
        body: {
          workDepartmentId: logDepartmentId,
          taskTemplateId: logTaskTemplateId,
          activityDate,
          startTime,
          endTime,
          payload: logPayload,
          status: "submitted"
        }
      }),
    onSuccess: async () => {
      setLogError(null);
      setIsLogModalOpen(false);
      setLogDepartmentId("");
      setLogTaskTemplateId("");
      setLogPayload({});
      setActivityDate(localDateValue());
      setStartTime("");
      setEndTime("");
      if (activeTenantId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(activeTenantId) });
      }
    },
    onError: (nextError) => {
      setLogError(nextError instanceof Error ? nextError.message : "Failed to log activity.");
    }
  });

  const editingActivity = useMemo(
    () => allActivities.find((activity) => activity.id === editingActivityId) ?? null,
    [allActivities, editingActivityId]
  );

  const resubmitMutation = useMutation({
    mutationFn: (input: { activityId: string; payload: Record<string, unknown> }) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${input.activityId}/resubmit`, {
        body: { payload: input.payload }
      }),
    onSuccess: async () => {
      setResubmitError(null);
      setEditingActivityId(null);
      setResubmitPayload({});
      if (activeTenantId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(activeTenantId) });
      }
    },
    onError: (nextError) => {
      setResubmitError(nextError instanceof Error ? nextError.message : "Failed to resubmit activity.");
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.delete<void>(`/v1/tenants/${activeTenantId}/activities/${activityId}`),
    onSuccess: async () => {
      if (activeTenantId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(activeTenantId) });
      }
      if (selectedActivity && ["submitted", "resubmitted"].includes(selectedActivity.status)) {
        setSelectedActivity(null);
      }
    }
  });

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  const canDeleteActivity = (activity: ActivityEntry) =>
    activity.userId === activeMembership.userId && ["submitted", "resubmitted"].includes(activity.status);

  function openLogModal() {
    setLogError(null);
    setLogDepartmentId(activeMembership?.homeDepartmentId ?? "");
    setLogTaskTemplateId("");
    setLogPayload({});
    setActivityDate(localDateValue());
    setStartTime("");
    setEndTime("");
    setIsLogModalOpen(true);
  }

  function openFiltersModal() {
    setFilterDraft(filters);
    setIsFilterModalOpen(true);
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

  function clearFilterDraft() {
    setFilterDraft(createDefaultFilters(localDateValue()));
  }

  function clearAppliedFilters() {
    const nextDefaults = createDefaultFilters(localDateValue());
    setFilters(nextDefaults);
    setFilterDraft(nextDefaults);
  }

  async function submitNewActivity() {
    setLogError(null);
    if (!logDepartmentId) {
      setLogError("Department is required.");
      return;
    }
    if (!logTaskTemplateId) {
      setLogError("Activity is required.");
      return;
    }
    if (logValidationIssues.length > 0) {
      setLogError("Resolve validation issues before logging activity.");
      return;
    }
    await createActivityMutation.mutateAsync();
  }

  const activeFilterCount =
    [
      filters.dateMode === "range" || filters.dateFrom !== today || filters.dateTo !== today ? "date" : "",
      filters.departmentId,
      filters.status,
      filters.taskTemplateId,
      filters.keyword.trim()
    ].filter(Boolean).length;

  const appliedFilterLabels: string[] = [];

  if (filters.dateMode === "range") {
    appliedFilterLabels.push(`Date: ${formatDateLabel(filters.dateFrom)} to ${formatDateLabel(filters.dateTo)}`);
  } else {
    appliedFilterLabels.push(`Date: ${formatDateLabel(filters.dateFrom)}`);
  }

  if (filters.departmentId) {
    appliedFilterLabels.push(`Department: ${departmentNameById.get(filters.departmentId) ?? "Unknown department"}`);
  }
  if (filters.status) {
    appliedFilterLabels.push(`Status: ${filters.status}`);
  }
  if (filters.taskTemplateId) {
    appliedFilterLabels.push(`Activity: ${activityTemplateNameById.get(filters.taskTemplateId) ?? "Unknown activity"}`);
  }
  if (filters.keyword.trim()) {
    appliedFilterLabels.push(`Keyword: ${filters.keyword.trim()}`);
  }

  const selectedActivityFieldPairs: Array<{ key: string; label: string; value: string }> = [];
  if (selectedActivity) {
    const seenKeys = new Set<string>();

    for (const field of selectedActivity.taskSchemaSnapshot) {
      seenKeys.add(field.key);
      selectedActivityFieldPairs.push({
        key: field.key,
        label: field.label || humanizeKey(field.key),
        value: formatPayloadValue(selectedActivity.payload[field.key])
      });
    }

    for (const [key, value] of Object.entries(selectedActivity.payload)) {
      if (seenKeys.has(key)) {
        continue;
      }
      selectedActivityFieldPairs.push({
        key,
        label: humanizeKey(key),
        value: formatPayloadValue(value)
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title="My Activity"
            subtitle="All filters are applied from the filter modal. Current selections are listed below."
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={openFiltersModal}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <Button variant="ghost" onClick={clearAppliedFilters}>
              Reset
            </Button>
            <Button onClick={openLogModal}>Log Activity</Button>
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

      <Card>
        <SectionTitle title="Personal Dashboard" subtitle="Weekly/monthly totals and personal trend overview." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-brand-mist/70 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-brand-moss">This Week</p>
            <p className="mt-2 text-2xl font-bold text-brand-slate">{formatDuration(performanceStats.weekMinutes)}</p>
            <p className={`mt-1 text-xs ${performanceStats.weekTrend.positive ? "text-[#15803d]" : "text-[#b42318]"}`}>
              {performanceStats.weekTrend.label} vs last week
            </p>
          </article>
          <article className="rounded-lg border border-brand-mist/70 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-brand-moss">This Month</p>
            <p className="mt-2 text-2xl font-bold text-brand-slate">{formatDuration(performanceStats.monthMinutes)}</p>
            <p className={`mt-1 text-xs ${performanceStats.monthTrend.positive ? "text-[#15803d]" : "text-[#b42318]"}`}>
              {performanceStats.monthTrend.label} vs last month
            </p>
          </article>
          <article className="rounded-lg border border-brand-mist/70 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-brand-moss">Week Logs</p>
            <p className="mt-2 text-2xl font-bold text-brand-slate">{performanceStats.weekEntries}</p>
            <p className={`mt-1 text-xs ${performanceStats.weekEntryTrend.positive ? "text-[#15803d]" : "text-[#b42318]"}`}>
              {performanceStats.weekEntryTrend.label} vs last week
            </p>
          </article>
          <article className="rounded-lg border border-brand-mist/70 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-brand-moss">Approval Rate</p>
            <p className="mt-2 text-2xl font-bold text-brand-slate">{performanceStats.approvalRate}</p>
            <p className="mt-1 text-xs text-brand-moss">Based on reviewed entries</p>
          </article>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="Entries"
            subtitle={`${filteredActivities.length} log${filteredActivities.length === 1 ? "" : "s"} in selected range.`}
          />
        </div>

        {activitiesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading entries...</p> : null}
        {activitiesQuery.error ? (
          <InlineError
            message={
              activitiesQuery.error instanceof Error
                ? activitiesQuery.error.message
                : "Failed to load activity entries."
            }
          />
        ) : null}
        {deleteActivityMutation.error ? (
          <InlineError
            message={
              deleteActivityMutation.error instanceof Error
                ? deleteActivityMutation.error.message
                : "Failed to delete activity."
            }
          />
        ) : null}

        {!activitiesQuery.isLoading && !activitiesQuery.error ? (
          filteredActivities.length ? (
            <div className="space-y-2">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedActivity(activity)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedActivity(activity);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-2 rounded-md border border-brand-mist/60 bg-white p-3 transition hover:border-brand-moss/60 hover:bg-brand-mist/20 focus:outline-none focus:ring-2 focus:ring-brand-moss/30 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-brand-slate">{activity.taskTemplateName}</p>
                    <p className="text-xs text-brand-moss">
                      {formatDepartment(activity.workDepartmentId)} | {activity.activityDate} | {activity.startTime}-{activity.endTime} |{" "}
                      {formatDuration(getActivityDurationMinutes(activity))}
                    </p>
                    <p className="text-xs text-brand-moss">{formatDate(activity.createdAt)}</p>
                    {activity.rejectionReason ? (
                      <p className="text-xs text-red-700">Reason: {activity.rejectionReason}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge value={activity.status} tone={toneByStatus(activity.status)} />
                    {canDeleteActivity(activity) ? (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-700/80 hover:bg-red-50 hover:text-red-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!window.confirm("Delete this submitted log? This action cannot be undone.")) {
                            return;
                          }
                          void deleteActivityMutation.mutateAsync(activity.id);
                        }}
                        disabled={deleteActivityMutation.isPending}
                      >
                        Delete
                      </Button>
                    ) : null}
                    {activity.status === "rejected" ? (
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingActivityId(activity.id);
                          setResubmitPayload(activity.payload);
                        }}
                      >
                        Resubmit
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-brand-moss">No logs for the selected date range and filters.</p>
          )
        ) : null}
      </Card>

      {selectedActivity ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4"
          onClick={() => setSelectedActivity(null)}
        >
          <section
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                  Logged Activity Details
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Review the task details and submitted information for this log.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedActivity(null)}>
                Close
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Task</p>
                <p className="mt-1 font-semibold text-brand-slate">{selectedActivity.taskTemplateName}</p>
              </article>
              <article className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Status</p>
                <div className="mt-1">
                  <Badge value={selectedActivity.status} tone={toneByStatus(selectedActivity.status)} />
                </div>
              </article>
              <article className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Department</p>
                <p className="mt-1 font-semibold text-brand-slate">{formatDepartment(selectedActivity.workDepartmentId)}</p>
              </article>
              <article className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Date and Time</p>
                <p className="mt-1 font-semibold text-brand-slate">
                  {selectedActivity.activityDate} | {selectedActivity.startTime}-{selectedActivity.endTime}
                </p>
                <p className="mt-1 text-xs text-brand-moss">
                  Duration: {formatDuration(getActivityDurationMinutes(selectedActivity))}
                </p>
              </article>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border border-brand-mist/70 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Logged On</p>
                <p className="mt-1 text-sm text-brand-slate">{formatDate(selectedActivity.createdAt)}</p>
              </article>
              <article className="rounded-lg border border-brand-mist/70 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-brand-moss">Last Updated</p>
                <p className="mt-1 text-sm text-brand-slate">{formatDate(selectedActivity.updatedAt)}</p>
              </article>
              {selectedActivity.submittedAt ? (
                <article className="rounded-lg border border-brand-mist/70 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-brand-moss">Submitted On</p>
                  <p className="mt-1 text-sm text-brand-slate">{formatDate(selectedActivity.submittedAt)}</p>
                </article>
              ) : null}
              {selectedActivity.reviewedAt ? (
                <article className="rounded-lg border border-brand-mist/70 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-brand-moss">Reviewed On</p>
                  <p className="mt-1 text-sm text-brand-slate">{formatDate(selectedActivity.reviewedAt)}</p>
                </article>
              ) : null}
            </div>

            {selectedActivity.rejectionReason ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs uppercase tracking-wide text-red-700">Rejection Reason</p>
                <p className="mt-1 text-sm text-red-700">{selectedActivity.rejectionReason}</p>
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">Submitted Details</h3>
              {selectedActivityFieldPairs.length ? (
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  {selectedActivityFieldPairs.map((fieldPair) => (
                    <div key={fieldPair.key} className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3">
                      <dt className="text-xs uppercase tracking-wide text-brand-moss">{fieldPair.label}</dt>
                      <dd className="mt-1 text-sm text-brand-slate">{fieldPair.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-brand-moss">No additional details were submitted.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

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
                  Select date, department, status, activity, and keyword filters here.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIsFilterModalOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-4">
                <Label htmlFor="filter-date-mode-modal">Date</Label>
                <Select
                  id="filter-date-mode-modal"
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
                    <Label htmlFor="filter-date-from-modal">
                      {filterDraft.dateMode === "range" ? "Start date" : "Date"}
                    </Label>
                    <Input
                      id="filter-date-from-modal"
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
                      <Label htmlFor="filter-date-to-modal">End date</Label>
                      <Input
                        id="filter-date-to-modal"
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
                {filterDraftDateRangeError ? (
                  <p className="mt-2 text-sm text-red-700">{filterDraftDateRangeError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="filter-department-modal">Department</Label>
                  <Select
                    id="filter-department-modal"
                    value={filterDraft.departmentId}
                    onChange={(event) =>
                      setFilterDraft((state) => ({ ...state, departmentId: event.target.value }))
                    }
                  >
                    <option value="">All departments</option>
                    {(departmentsQuery.data ?? []).map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-status-modal">Status</Label>
                  <Select
                    id="filter-status-modal"
                    value={filterDraft.status}
                    onChange={(event) =>
                      setFilterDraft((state) => ({
                        ...state,
                        status: event.target.value as ActivityFilters["status"]
                      }))
                    }
                  >
                    <option value="">All statuses</option>
                    {ACTIVITY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-template-modal">Activity</Label>
                  <Select
                    id="filter-template-modal"
                    value={filterDraft.taskTemplateId}
                    onChange={(event) =>
                      setFilterDraft((state) => ({ ...state, taskTemplateId: event.target.value }))
                    }
                  >
                    <option value="">All activities</option>
                    {activityTemplateOptions.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-keyword-modal">Keyword</Label>
                  <Input
                    id="filter-keyword-modal"
                    value={filterDraft.keyword}
                    onChange={(event) =>
                      setFilterDraft((state) => ({ ...state, keyword: event.target.value }))
                    }
                    placeholder="Search task or reason"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={clearFilterDraft}>
                Clear
              </Button>
              <Button
                disabled={Boolean(filterDraftDateRangeError)}
                onClick={() => {
                  if (filterDraftDateRangeError) {
                    return;
                  }
                  setFilters({ ...filterDraft });
                  setIsFilterModalOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {isLogModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4"
          onClick={() => {
            if (createActivityMutation.isPending) {
              return;
            }
            setIsLogModalOpen(false);
          }}
        >
          <section
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                  Log Activity
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Select department and task, then provide date and time range.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (createActivityMutation.isPending) {
                    return;
                  }
                  setIsLogModalOpen(false);
                }}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="log-department">Department</Label>
                <Select
                  id="log-department"
                  value={logDepartmentId}
                  onChange={(event) => {
                    setLogDepartmentId(event.target.value);
                    setLogTaskTemplateId("");
                    setLogPayload({});
                  }}
                >
                  <option value="">Select department</option>
                  {(departmentsQuery.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
              <TaskTemplateSelect
                templates={tasksQuery.data ?? []}
                value={logTaskTemplateId}
                onChange={(nextTemplateId) => {
                  setLogTaskTemplateId(nextTemplateId);
                  setLogPayload({});
                }}
                disabled={!logDepartmentId}
              />
            </div>

            {selectedTemplate ? (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="activity-date">Activity Date *</Label>
                    <Input
                      id="activity-date"
                      type="date"
                      value={activityDate}
                      onChange={(event) => setActivityDate(event.target.value)}
                    />
                    {!activityDate ? <p className="mt-1 text-xs text-red-700">Activity date is required.</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="start-time">Start Time *</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                    {!startTime ? <p className="mt-1 text-xs text-red-700">Start time is required.</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="end-time">End Time *</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                    {!endTime ? <p className="mt-1 text-xs text-red-700">End time is required.</p> : null}
                    {startTime && endTime && endTime <= startTime ? (
                      <p className="mt-1 text-xs text-red-700">End time must be later than start time.</p>
                    ) : null}
                  </div>
                </div>

                {overlapWarnings.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <p className="font-semibold">Time-overlap detected</p>
                    <p className="mt-1">This entry overlaps with existing logs on {activityDate}:</p>
                    <ul className="mt-1 list-disc pl-4">
                      {overlapWarnings.slice(0, 5).map((activity) => (
                        <li key={activity.id}>
                          {activity.taskTemplateName} ({activity.startTime}-{activity.endTime})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4">
                  <DynamicFieldRenderer
                    fields={selectedTemplate.fields}
                    values={logPayload}
                    onChange={(fieldKey, value) =>
                      setLogPayload((current) => ({
                        ...current,
                        [fieldKey]: value
                      }))
                    }
                  />
                </div>
                <div className="mt-4">
                  <ValidationSummary errors={logValidationIssues} />
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-brand-moss">Select a department and task to continue.</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (createActivityMutation.isPending) {
                    return;
                  }
                  setIsLogModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={createActivityMutation.isPending || !selectedTemplate}
                onClick={() => {
                  void submitNewActivity();
                }}
              >
                {createActivityMutation.isPending ? "Logging..." : "Log Activity"}
              </Button>
            </div>
            <InlineError message={logError} />
          </section>
        </div>
      ) : null}

      {editingActivity ? (
        <Card>
          <SectionTitle title="Resubmit Activity" subtitle={editingActivity.taskTemplateName} />
          <DynamicFieldRenderer
            fields={editingActivity.taskSchemaSnapshot}
            values={resubmitPayload}
            onChange={(fieldKey, value) =>
              setResubmitPayload((state) => ({
                ...state,
                [fieldKey]: value
              }))
            }
          />
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                resubmitMutation.mutate({
                  activityId: editingActivity.id,
                  payload: resubmitPayload
                })
              }
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit"}
            </Button>
            <Button variant="ghost" onClick={() => setEditingActivityId(null)}>
              Cancel
            </Button>
          </div>
          <InlineError message={resubmitError} />
        </Card>
      ) : null}
    </div>
  );
}
