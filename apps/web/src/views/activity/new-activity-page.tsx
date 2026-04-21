"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { TaskTemplate } from "@/lib/types";
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
  payload: Record<string, unknown>;
  status: "draft" | "submitted";
}

export default function NewActivityPage() {
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const [departmentId, setDepartmentId] = useState("");
  const [taskTemplateId, setTaskTemplateId] = useState("");
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

  const selectedTemplate = useMemo(
    () => tasksQuery.data?.find((template) => template.id === taskTemplateId) ?? null,
    [taskTemplateId, tasksQuery.data]
  );

  const validationIssues = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }
    const issues: string[] = [];
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
  }, [payload, selectedTemplate]);

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
    if (status === "submitted" && validationIssues.length > 0) {
      setError("Resolve validation issues before submission.");
      return;
    }

    await createActivityMutation.mutateAsync({
      workDepartmentId: departmentId.trim(),
      taskTemplateId,
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
            Activity saved successfully: <strong>{lastResultId}</strong>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
