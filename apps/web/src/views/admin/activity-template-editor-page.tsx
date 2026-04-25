"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TaskTemplate } from "@/lib/types";
import { DepartmentTaskAssignment } from "@/components/admin/department-task-assignment";
import { TaskTemplateBuilder } from "@/components/admin/task-template-builder";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";

export function ActivityTemplateEditorPage({
  mode,
  taskTemplateId
}: {
  mode: "create" | "edit";
  taskTemplateId?: string;
}) {
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();
  const [createdTemplate, setCreatedTemplate] = useState<TaskTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantTaskTemplates(activeTenantId) : ["tenant-task-templates", "none"],
    queryFn: () => apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/task-templates`),
    enabled: Boolean(activeTenantId)
  });

  const canManageTemplates =
    (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.taskTemplateManage);
  const canAssignTemplates =
    canManageTemplates || permissions.has(PERMISSIONS.taskAssign);

  const selectedTemplate = useMemo(() => {
    if (mode === "create") {
      return createdTemplate;
    }
    if (!taskTemplateId) {
      return null;
    }
    return (templatesQuery.data ?? []).find((template) => template.id === taskTemplateId) ?? null;
  }, [createdTemplate, mode, taskTemplateId, templatesQuery.data]);

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title={mode === "create" ? "Add Activity" : "Edit Activity"}
          subtitle={
            mode === "create"
              ? "Create activity template with form builder and assign it to one or more departments."
              : "Edit activity details, form builder fields, and multi-department assignments."
          }
        />
        <Link href={tenantRoutes.activities(activeTenantId)} className="text-sm font-semibold text-brand-moss underline">
          Back to Activities List
        </Link>
      </Card>

      {mode === "edit" && templatesQuery.isLoading ? (
        <Card>
          <p className="text-sm text-brand-moss">Loading activity details...</p>
        </Card>
      ) : null}
      {mode === "edit" && templatesQuery.error ? (
        <Card>
          <p className="text-sm text-red-700">
            {templatesQuery.error instanceof Error ? templatesQuery.error.message : "Failed to load activity details."}
          </p>
        </Card>
      ) : null}
      {mode === "edit" && !templatesQuery.isLoading && !selectedTemplate ? (
        <Card>
          <p className="text-sm text-red-700">Activity template not found.</p>
        </Card>
      ) : null}

      {mode === "create" || selectedTemplate ? (
        <>
          <TaskTemplateBuilder
            tenantId={activeTenantId}
            template={selectedTemplate}
            canManage={canManageTemplates}
            onSaved={async (savedTemplate) => {
              setCreatedTemplate(savedTemplate);
              await queryClient.invalidateQueries({ queryKey: queryKeys.tenantTaskTemplates(activeTenantId) });
            }}
          />
          <DepartmentTaskAssignment
            tenantId={activeTenantId}
            selectedTemplate={selectedTemplate}
            canAssign={canAssignTemplates}
          />
        </>
      ) : null}
    </div>
  );
}
