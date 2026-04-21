"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { TaskTemplate } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

export function DepartmentTaskAssignment({
  tenantId,
  templates
}: {
  tenantId: string;
  templates: TaskTemplate[];
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [taskTemplateId, setTaskTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: queryKeys.departmentTasks(tenantId, departmentId),
    queryFn: () =>
      apiClient.get<TaskTemplate[]>(`/v1/tenants/${tenantId}/departments/${departmentId}/tasks`),
    enabled: Boolean(departmentId)
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { departmentId: string; taskTemplateId: string }) =>
      apiClient.post(`/v1/tenants/${tenantId}/departments/${payload.departmentId}/tasks/${payload.taskTemplateId}`),
    onSuccess: async (_response, variables) => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.departmentTasks(tenantId, variables.departmentId)
      });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to assign template.");
    }
  });

  return (
    <Card>
      <SectionTitle
        title="Assign Template to Department"
        subtitle="Provide department id and assign one of the created templates."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="department-task-department">Department ID</Label>
          <Input
            id="department-task-department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            placeholder="department-id"
          />
        </div>
        <div>
          <Label htmlFor="department-task-template">Template</Label>
          <Select
            id="department-task-template"
            value={taskTemplateId}
            onChange={(event) => setTaskTemplateId(event.target.value)}
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-3">
        <Button
          disabled={assignMutation.isPending || !departmentId.trim() || !taskTemplateId}
          onClick={() =>
            assignMutation.mutate({
              departmentId: departmentId.trim(),
              taskTemplateId
            })
          }
        >
          {assignMutation.isPending ? "Assigning..." : "Assign Template"}
        </Button>
      </div>
      <InlineError message={error} />

      {departmentId ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-brand-slate">Assigned templates in {departmentId}</p>
          {tasksQuery.isLoading ? <p className="text-sm text-brand-moss">Loading tasks...</p> : null}
          {tasksQuery.data?.length ? (
            <ul className="space-y-1 text-sm text-brand-moss">
              {tasksQuery.data.map((task) => (
                <li key={task.id}>
                  {task.name} ({task.id})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brand-moss">No assignments found.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
