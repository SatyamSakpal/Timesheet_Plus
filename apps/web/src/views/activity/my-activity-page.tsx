"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useMeQuery } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import type { ActivityEntry } from "@/lib/types";
import { DynamicFieldRenderer } from "@/components/activity/dynamic-field-renderer";
import { DepartmentSelect } from "@/components/activity/department-select";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Badge, Button, Card, InlineError, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

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

export default function MyActivityPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const meQuery = useMeQuery();
  const { activeTenantId, activeMembership } = useActiveTenant();
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [resubmitPayload, setResubmitPayload] = useState<Record<string, unknown>>({});

  const activitiesQuery = useQuery({
    queryKey:
      activeTenantId && departmentId && meQuery.data
        ? queryKeys.departmentActivities(activeTenantId, departmentId, meQuery.data.user.id)
        : ["my-activities", "none"],
    queryFn: () =>
      apiClient.get<ActivityEntry[]>(`/v1/tenants/${activeTenantId}/departments/${departmentId}/activities`, {
        query: { userId: meQuery.data?.user.id }
      }),
    enabled: Boolean(activeTenantId && departmentId && meQuery.data?.user.id)
  });

  const editingActivity = useMemo(
    () => activitiesQuery.data?.find((activity) => activity.id === editingActivityId) ?? null,
    [activitiesQuery.data, editingActivityId]
  );

  const resubmitMutation = useMutation({
    mutationFn: (input: { activityId: string; payload: Record<string, unknown> }) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${input.activityId}/resubmit`, {
        body: { payload: input.payload }
      }),
    onSuccess: async () => {
      setError(null);
      setEditingActivityId(null);
      setResubmitPayload({});
      if (activeTenantId && departmentId && meQuery.data?.user.id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.departmentActivities(activeTenantId, departmentId, meQuery.data.user.id)
        });
      }
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to resubmit activity.");
    }
  });

  if (!activeTenantId || !activeMembership) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="My Activity"
          subtitle="Select a department to load your entries. API access depends on tenant permissions."
        />
        <div className="max-w-lg">
          <DepartmentSelect
            tenantId={activeTenantId}
            value={departmentId}
            homeDepartmentId={activeMembership.homeDepartmentId}
            onChange={(nextDepartmentId) => {
              setDepartmentId(nextDepartmentId);
              setEditingActivityId(null);
            }}
          />
        </div>
        {activitiesQuery.error ? (
          <InlineError
            message={
              activitiesQuery.error instanceof Error
                ? activitiesQuery.error.message
                : "Failed to load activity entries."
            }
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Entries" subtitle="Re-submit rejected entries after corrections." />
        {activitiesQuery.isLoading ? <p className="text-sm text-brand-moss">Loading entries...</p> : null}
        {activitiesQuery.data?.length ? (
          <div className="space-y-2">
            {activitiesQuery.data.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-2 rounded-md border border-brand-mist/60 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-brand-slate">{activity.taskTemplateName}</p>
                  <p className="text-xs text-brand-moss">
                    {activity.id} | {formatDate(activity.createdAt)}
                  </p>
                  {activity.rejectionReason ? (
                    <p className="text-xs text-red-700">Reason: {activity.rejectionReason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={activity.status} tone={toneByStatus(activity.status)} />
                  {activity.status === "rejected" ? (
                    <Button
                      onClick={() => {
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
          <p className="text-sm text-brand-moss">No entries found for selected department.</p>
        )}
      </Card>

      {editingActivity ? (
        <Card>
          <SectionTitle title="Resubmit Activity" subtitle={`Activity ${editingActivity.id}`} />
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
          <InlineError message={error} />
        </Card>
      ) : null}
    </div>
  );
}
