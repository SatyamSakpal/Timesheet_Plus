"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { ActivityEntry, TaskTemplate } from "@/lib/types";
import { ActivitySubmitBar } from "@/components/activity/activity-submit-bar";
import { DepartmentSelect } from "@/components/activity/department-select";
import { DynamicFieldRenderer } from "@/components/activity/dynamic-field-renderer";
import { TaskTemplateSelect } from "@/components/activity/task-template-select";
import { ValidationSummary } from "@/components/activity/validation-summary";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Card, InlineError, SectionTitle } from "@/components/ui/primitives";

interface CreateActivityInput {
  workDepartmentId: string;
  taskTemplateId: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  payload: Record<string, unknown>;
  status: "draft" | "submitted";
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

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export default function NewActivityPage() {
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const [departmentId, setDepartmentId] = useState("");
  const [taskTemplateId, setTaskTemplateId] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastResultId, setLastResultId] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: activeTenantId && departmentId
      ? queryKeys.departmentTasks(activeTenantId, departmentId)
      : ["department-tasks", "none"],
    queryFn: () =>
      apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/departments/${departmentId}/tasks`),
    enabled: Boolean(activeTenantId && departmentId)
  });

  const activitiesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.myActivities(activeTenantId) : ["my-activities", "none"],
    queryFn: () => apiClient.get<ActivityEntry[]>(`/v1/tenants/${activeTenantId}/activities/my`),
    enabled: Boolean(activeTenantId)
  });

  const selectedTemplate = useMemo(
    () => tasksQuery.data?.find((template) => template.id === taskTemplateId) ?? null,
    [taskTemplateId, tasksQuery.data]
  );

  const overlapWarnings = useMemo(() => {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (!activityDate || start === null || end === null || end <= start) {
      return [] as ActivityEntry[];
    }

    return (activitiesQuery.data ?? [])
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
  }, [activitiesQuery.data, activityDate, endTime, startTime]);

  const validationIssues = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }
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
    for (const field of selectedTemplate.fields) {
      if (!field.required) {
        continue;
      }
      const value = payload[field.key];
      if (value === undefined || value === null || value === "") {
        issues.push(`"${field.label}" is required.`);
      }
    }
    return issues;
  }, [activityDate, endTime, overlapWarnings, payload, selectedTemplate, startTime]);

  const createActivityMutation = useMutation({
    mutationFn: (input: CreateActivityInput) =>
      apiClient.post<{ id: string }>(`/v1/tenants/${activeTenantId}/activities`, { body: input }),
    onSuccess: (result) => {
      setLastResultId(result.id);
      setError(null);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create activity.");
    }
  });

  async function submit(status: "draft" | "submitted") {
    if (!activeTenantId) {
      return;
    }
    setError(null);
    if (!departmentId.trim()) {
      setError("Work department is required.");
      return;
    }
    if (!taskTemplateId) {
      setError("Task template is required.");
      return;
    }
    if (validationIssues.length > 0) {
      setError("Resolve validation issues before submission.");
      return;
    }

    await createActivityMutation.mutateAsync({
      workDepartmentId: departmentId.trim(),
      taskTemplateId,
      activityDate,
      startTime,
      endTime,
      payload,
      status
    });
  }

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="New Activity Entry" subtitle="Department -> Task -> Dynamic Fields -> Save Draft / Submit" />
        <div className="grid gap-3 md:grid-cols-2">
          <DepartmentSelect
            tenantId={activeTenantId}
            value={departmentId}
            homeDepartmentId={activeMembership.homeDepartmentId}
            onChange={(nextDepartmentId) => {
              setDepartmentId(nextDepartmentId);
              setTaskTemplateId("");
              setPayload({});
            }}
          />
          <TaskTemplateSelect
            templates={tasksQuery.data ?? []}
            value={taskTemplateId}
            onChange={(nextTemplateId) => {
              setTaskTemplateId(nextTemplateId);
              setPayload({});
            }}
            disabled={!departmentId}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Task Payload" subtitle="Field schema is fetched from selected task template." />
        {tasksQuery.isLoading ? <p className="text-sm text-brand-moss">Loading templates...</p> : null}
        {selectedTemplate ? (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor="new-activity-date" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-moss">
                  Activity Date *
                </label>
                <input
                  id="new-activity-date"
                  type="date"
                  value={activityDate}
                  onChange={(event) => setActivityDate(event.target.value)}
                  className="w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20"
                />
              </div>
              <div>
                <label htmlFor="new-start-time" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-moss">
                  Start Time *
                </label>
                <input
                  id="new-start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20"
                />
              </div>
              <div>
                <label htmlFor="new-end-time" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-moss">
                  End Time *
                </label>
                <input
                  id="new-end-time"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20"
                />
              </div>
            </div>
            {overlapWarnings.length > 0 ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
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
            <DynamicFieldRenderer
              fields={selectedTemplate.fields}
              values={payload}
              onChange={(fieldKey, value) =>
                setPayload((current) => ({
                  ...current,
                  [fieldKey]: value
                }))
              }
            />
          </>
        ) : (
          <p className="text-sm text-brand-moss">Select a department and task template.</p>
        )}
        <div className="mt-4">
          <ValidationSummary errors={validationIssues} />
        </div>
        <div className="mt-4">
          <ActivitySubmitBar
            disabled={!selectedTemplate}
            isPending={createActivityMutation.isPending}
            onSaveDraft={() => {
              void submit("draft");
            }}
            onSubmit={() => {
              void submit("submitted");
            }}
          />
        </div>
        <InlineError message={error} />
        {lastResultId ? (
          <p className="mt-2 text-sm text-brand-moss">
            Activity saved successfully.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
