"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DepartmentEntity, TaskTemplate } from "@/lib/types";
import { Button, Card, InlineError, SectionTitle } from "@/components/ui/primitives";

export function DepartmentTaskAssignment({
  tenantId,
  selectedTemplate,
  canAssign
}: {
  tenantId: string;
  selectedTemplate: TaskTemplate | null;
  canAssign: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: queryKeys.tenantDepartments(tenantId),
    queryFn: () => apiClient.get<DepartmentEntity[]>(`/v1/tenants/${tenantId}/departments`)
  });

  const assignmentsQuery = useQuery({
    queryKey: ["template-department-assignments", tenantId, selectedTemplate?.id ?? "none"],
    queryFn: async () => {
      const departments = departmentsQuery.data ?? [];
      if (!selectedTemplate || departments.length === 0) {
        return [] as DepartmentEntity[];
      }
      const taskByDepartment = await Promise.all(
        departments.map(async (department) => {
          const templates = await apiClient.get<TaskTemplate[]>(
            `/v1/tenants/${tenantId}/departments/${department.id}/tasks`
          );
          const hasTemplate = templates.some((template) => template.id === selectedTemplate.id);
          return hasTemplate ? department : null;
        })
      );
      return taskByDepartment.filter((department): department is DepartmentEntity => Boolean(department));
    },
    enabled: Boolean(selectedTemplate && departmentsQuery.data)
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { departmentIds: string[]; taskTemplateId: string }) => {
      await Promise.all(
        payload.departmentIds.map((departmentId) =>
          apiClient.post(`/v1/tenants/${tenantId}/departments/${departmentId}/tasks/${payload.taskTemplateId}`)
        )
      );
    },
    onSuccess: async (_, variables) => {
      setError(null);
      setSelectedDepartmentIds([]);
      await Promise.all([
        ...variables.departmentIds.map((departmentId) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.departmentTasks(tenantId, departmentId)
          })
        ),
        queryClient.invalidateQueries({
          queryKey: ["template-department-assignments", tenantId, variables.taskTemplateId]
        })
      ]);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to assign activity template.");
    }
  });

  const unassignMutation = useMutation({
    mutationFn: (payload: { departmentId: string; taskTemplateId: string }) =>
      apiClient.delete(`/v1/tenants/${tenantId}/departments/${payload.departmentId}/tasks/${payload.taskTemplateId}`),
    onSuccess: async (_, variables) => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.departmentTasks(tenantId, variables.departmentId)
        }),
        queryClient.invalidateQueries({
          queryKey: ["template-department-assignments", tenantId, variables.taskTemplateId]
        })
      ]);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to remove department assignment.");
    }
  });

  const assignedDepartmentIds = useMemo(
    () => new Set((assignmentsQuery.data ?? []).map((department) => department.id)),
    [assignmentsQuery.data]
  );

  const assignableDepartments = useMemo(
    () => (departmentsQuery.data ?? []).filter((department) => !assignedDepartmentIds.has(department.id)),
    [assignedDepartmentIds, departmentsQuery.data]
  );

  useEffect(() => {
    setSelectedDepartmentIds((current) =>
      current.filter((departmentId) => assignableDepartments.some((department) => department.id === departmentId))
    );
  }, [assignableDepartments]);

  if (!selectedTemplate) {
    return (
      <Card>
        <SectionTitle title="Department Assignment" subtitle="Create or open an activity first." />
        <p className="text-sm text-brand-moss">
          You can assign an activity to multiple departments after selecting/saving a template.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Assign Activity to Departments"
        subtitle={`Selected: ${selectedTemplate.name}`}
      />

      {!canAssign ? (
        <p className="text-sm text-brand-moss">You do not have permission to assign templates to departments.</p>
      ) : (
        <>
          {assignableDepartments.length > 0 ? (
            <div className="space-y-2">
              {assignableDepartments.map((department) => {
                const checked = selectedDepartmentIds.includes(department.id);
                return (
                  <label key={department.id} className="flex items-center gap-2 rounded-md border border-brand-mist/60 px-3 py-2 text-sm text-brand-slate">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedDepartmentIds((state) => [...state, department.id]);
                          return;
                        }
                        setSelectedDepartmentIds((state) => state.filter((id) => id !== department.id));
                      }}
                      disabled={assignMutation.isPending}
                    />
                    <span>{department.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-brand-moss">Already assigned to all available departments.</p>
          )}

          <div className="mt-3">
            <Button
              disabled={assignMutation.isPending || selectedDepartmentIds.length === 0}
              onClick={() =>
                assignMutation.mutate({
                  departmentIds: selectedDepartmentIds,
                  taskTemplateId: selectedTemplate.id
                })
              }
            >
              {assignMutation.isPending ? "Assigning..." : `Assign to ${selectedDepartmentIds.length} Department(s)`}
            </Button>
          </div>
          <InlineError message={error} />
        </>
      )}

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-brand-slate">Assigned Departments</p>
        {assignmentsQuery.isLoading ? <p className="text-sm text-brand-moss">Loading assignments...</p> : null}
        {assignmentsQuery.error ? (
          <p className="text-sm text-red-700">
            {assignmentsQuery.error instanceof Error
              ? assignmentsQuery.error.message
              : "Failed to load department assignments."}
          </p>
        ) : null}
        {(assignmentsQuery.data ?? []).length > 0 ? (
          <ul className="space-y-2 text-sm text-brand-moss">
            {(assignmentsQuery.data ?? []).map((department) => (
              <li
                key={department.id}
                className="flex items-center justify-between gap-2 rounded-md border border-brand-mist/60 bg-white px-3 py-2"
              >
                <span>{department.name}</span>
                {canAssign ? (
                  <Button
                    variant="ghost"
                    disabled={unassignMutation.isPending}
                    onClick={() =>
                      unassignMutation.mutate({
                        departmentId: department.id,
                        taskTemplateId: selectedTemplate.id
                      })
                    }
                  >
                    {unassignMutation.isPending ? "Removing..." : "Remove"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          !assignmentsQuery.isLoading && <p className="text-sm text-brand-moss">Not assigned to any department yet.</p>
        )}
      </div>
    </Card>
  );
}
