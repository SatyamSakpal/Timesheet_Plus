"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PERMISSIONS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TaskTemplate } from "@/lib/types";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";

export default function AdminTasksPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const { permissions } = useTenantPermissions();

  const templatesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.tenantTaskTemplates(activeTenantId) : ["tenant-task-templates", "none"],
    queryFn: () => apiClient.get<TaskTemplate[]>(`/v1/tenants/${activeTenantId}/task-templates`),
    enabled: Boolean(activeTenantId)
  });

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  const canManageTemplates =
    (activeMembership?.isOwner ?? false) || permissions.has(PERMISSIONS.taskTemplateManage);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="Activities"
            subtitle="List of activity templates. Click any activity to edit form builder and department assignments."
          />
          {canManageTemplates ? (
            <Button onClick={() => router.push(tenantRoutes.activitiesNew(activeTenantId))}>Add Activity</Button>
          ) : null}
        </div>
      </Card>

      <Card>
        {templatesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading activities...</p> : null}
        {templatesQuery.error ? (
          <p className="text-sm text-red-700">
            {templatesQuery.error instanceof Error ? templatesQuery.error.message : "Failed to load activities."}
          </p>
        ) : null}

        {(templatesQuery.data ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-mist text-xs uppercase tracking-wide text-brand-moss">
                <tr>
                  <th className="px-2 py-2">Activity</th>
                  <th className="px-2 py-2">Version</th>
                  <th className="px-2 py-2">Fields</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(templatesQuery.data ?? []).map((template) => (
                  <tr key={template.id} className="border-b border-brand-mist/60">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-left font-semibold text-brand-slate hover:text-brand-moss hover:underline"
                        onClick={() =>
                          router.push(tenantRoutes.activitiesDetail(activeTenantId, template.id))
                        }
                      >
                        {template.name}
                      </button>
                    </td>
                    <td className="px-2 py-2">v{template.version}</td>
                    <td className="px-2 py-2">{template.fields.length}</td>
                    <td className="px-2 py-2">{template.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          router.push(tenantRoutes.activitiesDetail(activeTenantId, template.id))
                        }
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !templatesQuery.isLoading && <p className="text-sm text-brand-moss">No activity templates found.</p>
        )}
      </Card>
    </div>
  );
}
