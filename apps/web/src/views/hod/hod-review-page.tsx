"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import type { ActivityEntry } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { ActivityDetailDrawer } from "@/components/hod/activity-detail-drawer";
import { ApproveRejectActions } from "@/components/hod/approve-reject-actions";
import { ReviewTable } from "@/components/hod/review-table";
import { TenantRequired } from "@/components/layout/tenant-required";
import { tenantRoutes } from "@/lib/tenant-routes";
import { Button, Card, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

interface FilterState {
  departmentId: string;
  status: string;
  userId: string;
  taskTemplateId: string;
  dateFrom: string;
  dateTo: string;
}

const defaultFilters: FilterState = {
  departmentId: "",
  status: "",
  userId: "",
  taskTemplateId: "",
  dateFrom: "",
  dateTo: ""
};

export default function HodReviewPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { activeTenantId } = useActiveTenant();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [submittedFilters, setSubmittedFilters] = useState<FilterState>(defaultFilters);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEntry | null>(null);

  const filterSignature = useMemo(() => JSON.stringify(submittedFilters), [submittedFilters]);

  const activitiesQuery = useQuery({
    queryKey:
      activeTenantId && submittedFilters.departmentId
        ? queryKeys.departmentActivities(activeTenantId, submittedFilters.departmentId, filterSignature)
        : ["hod-review", "none"],
    queryFn: () =>
      apiClient.get<ActivityEntry[]>(
        `/v1/tenants/${activeTenantId}/departments/${submittedFilters.departmentId}/activities`,
        {
          query: {
            status: submittedFilters.status || undefined,
            userId: submittedFilters.userId || undefined,
            taskTemplateId: submittedFilters.taskTemplateId || undefined,
            dateFrom: submittedFilters.dateFrom || undefined,
            dateTo: submittedFilters.dateTo || undefined
          }
        }
      ),
    enabled: Boolean(activeTenantId && submittedFilters.departmentId)
  });

  const approveMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<ActivityEntry>(`/v1/tenants/${activeTenantId}/activities/${activityId}/approve`),
    onSuccess: async (updatedActivity) => {
      if (activeTenantId && submittedFilters.departmentId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.departmentActivities(activeTenantId, submittedFilters.departmentId, filterSignature)
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
      }
      setSelectedActivity(updatedActivity);
    }
  });

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Review Queue" subtitle="Filter by department, date, status, user, and task." />
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="filter-department">Department ID</Label>
            <Input
              id="filter-department"
              value={filters.departmentId}
              onChange={(event) => setFilters((state) => ({ ...state, departmentId: event.target.value }))}
              placeholder="Required"
            />
          </div>
          <div>
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(event) => setFilters((state) => ({ ...state, status: event.target.value }))}
            >
              <option value="">Any</option>
              <option value="draft">draft</option>
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="resubmitted">resubmitted</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-user-id">User ID</Label>
            <Input
              id="filter-user-id"
              value={filters.userId}
              onChange={(event) => setFilters((state) => ({ ...state, userId: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="filter-task-template-id">Task Template ID</Label>
            <Input
              id="filter-task-template-id"
              value={filters.taskTemplateId}
              onChange={(event) => setFilters((state) => ({ ...state, taskTemplateId: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="filter-date-from">Date From (ISO)</Label>
            <Input
              id="filter-date-from"
              value={filters.dateFrom}
              onChange={(event) => setFilters((state) => ({ ...state, dateFrom: event.target.value }))}
              placeholder="2026-04-01T00:00:00.000Z"
            />
          </div>
          <div>
            <Label htmlFor="filter-date-to">Date To (ISO)</Label>
            <Input
              id="filter-date-to"
              value={filters.dateTo}
              onChange={(event) => setFilters((state) => ({ ...state, dateTo: event.target.value }))}
              placeholder="2026-04-30T23:59:59.999Z"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setSubmittedFilters(filters)}>Apply Filters</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(defaultFilters);
              setSubmittedFilters(defaultFilters);
              setSelectedActivity(null);
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionTitle title="Activities" />
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
          />
        </Card>

        <div className="space-y-4">
          <ActivityDetailDrawer activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
          {selectedActivity ? (
            <Card>
              <SectionTitle title="Actions" subtitle="Approve or reject selected entry." />
              <Link
                href={tenantRoutes.hodDepartmentMembers(activeTenantId, selectedActivity.workDepartmentId)}
                className="mb-3 inline-block text-sm font-semibold text-brand-moss underline"
              >
                Open member/contributor view for this department
              </Link>
              <ApproveRejectActions
                disabled={!["submitted", "resubmitted"].includes(selectedActivity.status)}
                onApprove={() => approveMutation.mutateAsync(selectedActivity.id).then(() => undefined)}
                onReject={(reason) =>
                  rejectMutation
                    .mutateAsync({ activityId: selectedActivity.id, reason })
                    .then(() => undefined)
                }
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
