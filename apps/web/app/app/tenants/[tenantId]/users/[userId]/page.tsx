"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApproveRejectActions } from "@/components/hod/approve-reject-actions";
import { TenantRequired } from "@/components/layout/tenant-required";
import { Badge, Button, Card, SectionTitle, Select } from "@/components/ui/primitives";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { classNames, formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { ActivityStatus, TenantRole, TenantUserDetailActivity, TenantUserDetailResponse } from "@/lib/types";

function activityTone(status: ActivityStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "approved") {
    return "success";
  }
  if (status === "rejected") {
    return "danger";
  }
  if (status === "draft") {
    return "neutral";
  }
  if (status === "resubmitted") {
    return "info";
  }
  return "warning";
}

function visibilityLabel(visibility: TenantUserDetailResponse["user"]["visibility"]) {
  if (visibility === "member+contributor") {
    return "Member + Contributor";
  }
  if (visibility === "member") {
    return "Member";
  }
  if (visibility === "contributor") {
    return "Contributor";
  }
  return "Tenant User";
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

export default function TenantUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { activeTenantId } = useActiveTenant();
  const [homeDepartmentDraft, setHomeDepartmentDraft] = useState("");
  const [roleDraftId, setRoleDraftId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const userDetailQuery = useQuery({
    queryKey:
      activeTenantId && userId ? queryKeys.tenantUserDetail(activeTenantId, userId) : ["tenant-user-detail", "none"],
    queryFn: () => apiClient.get<TenantUserDetailResponse>(`/v1/tenants/${activeTenantId}/users/${userId}`),
    enabled: Boolean(activeTenantId && userId)
  });

  const updateHomeDepartmentMutation = useMutation({
    mutationFn: (nextDepartmentId: string | null) =>
      apiClient.patch(`/v1/tenants/${activeTenantId}/users/${userId}/home-department`, {
        body: { homeDepartmentId: nextDepartmentId }
      }),
    onSuccess: async () => {
      if (!activeTenantId || !userId) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantUserDetail(activeTenantId, userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantUsersDirectory(activeTenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantMembers(activeTenantId) })
      ]);
    }
  });

  const rolesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.roles(activeTenantId) : ["roles", "none"],
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${activeTenantId}/roles`),
    enabled: Boolean(activeTenantId && userDetailQuery.data?.viewerCanManageMember)
  });

  const updateRoleMutation = useMutation({
    mutationFn: (nextRoleId: string) =>
      apiClient.post(`/v1/tenants/${activeTenantId}/members/${userId}/roles`, {
        body: { roleIds: [nextRoleId] }
      }),
    onSuccess: async () => {
      if (!activeTenantId || !userId) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantUserDetail(activeTenantId, userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantUsersDirectory(activeTenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantMembers(activeTenantId) })
      ]);
    }
  });

  const approveMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post(`/v1/tenants/${activeTenantId}/activities/${activityId}/approve`),
    onSuccess: async () => {
      if (!activeTenantId || !userId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantUserDetail(activeTenantId, userId) });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { activityId: string; reason: string }) =>
      apiClient.post(`/v1/tenants/${activeTenantId}/activities/${input.activityId}/reject`, {
        body: { reason: input.reason }
      }),
    onSuccess: async () => {
      if (!activeTenantId || !userId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantUserDetail(activeTenantId, userId) });
    }
  });

  useEffect(() => {
    const data = userDetailQuery.data;
    if (!data) {
      return;
    }
    setHomeDepartmentDraft(data.user.homeDepartmentId ?? "");
    setRoleDraftId(data.user.roleIds[0] ?? "");
    setSelectedActivityId((current) => {
      if (current && data.activities.some((activity) => activity.id === current)) {
        return current;
      }
      return data.activities[0]?.id ?? null;
    });
  }, [userDetailQuery.data]);

  const selectedActivity = useMemo(() => {
    if (!userDetailQuery.data || !selectedActivityId) {
      return null;
    }
    return (
      userDetailQuery.data.activities.find((activity) => activity.id === selectedActivityId) ?? null
    );
  }, [selectedActivityId, userDetailQuery.data]);

  const homeDepartmentDirty =
    (homeDepartmentDraft || null) !== (userDetailQuery.data?.user.homeDepartmentId ?? null);
  const selectedCurrentRoleId = userDetailQuery.data?.user.roleIds[0] ?? "";
  const roleDirty = roleDraftId !== selectedCurrentRoleId;

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle
              title={userDetailQuery.data?.user.name ?? "User Profile"}
              subtitle={userDetailQuery.data?.user.email ?? "Loading user details..."}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                value={userDetailQuery.data?.user.isOwner ? "Owner" : userDetailQuery.data?.user.roleNames[0] ?? "Member"}
                tone="info"
              />
              {userDetailQuery.data ? (
                <Badge value={visibilityLabel(userDetailQuery.data.user.visibility)} tone="neutral" />
              ) : null}
              {userDetailQuery.data ? <Badge value={userDetailQuery.data.user.status} tone="warning" /> : null}
            </div>
          </div>
          <Link href={tenantRoutes.users(activeTenantId)} className="text-sm font-semibold text-[#1d4ed8]">
            Back to Users
          </Link>
        </div>
      </Card>

      {userDetailQuery.isLoading ? (
        <Card>
          <p className="text-sm text-brand-moss">Loading user details...</p>
        </Card>
      ) : null}
      {userDetailQuery.error ? (
        <Card>
          <p className="text-sm text-red-700">
            {userDetailQuery.error instanceof Error ? userDetailQuery.error.message : "Failed to load user details."}
          </p>
        </Card>
      ) : null}

      {userDetailQuery.data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Total Entries</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">{userDetailQuery.data.stats.totalEntries}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Pending Review</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">
                {userDetailQuery.data.stats.pendingReviewCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Approved</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">{userDetailQuery.data.stats.approvedCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Rejected</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">{userDetailQuery.data.stats.rejectedCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Drafts</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">{userDetailQuery.data.stats.draftCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Submitted</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">{userDetailQuery.data.stats.submittedCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Resubmitted</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">
                {userDetailQuery.data.stats.resubmittedCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Departments Covered</p>
              <p className="mt-2 text-2xl font-semibold text-brand-slate">
                {userDetailQuery.data.stats.uniqueDepartments}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-brand-moss">Latest Activity</p>
              <p className="mt-2 text-sm font-semibold text-brand-slate">
                {formatDate(userDetailQuery.data.stats.latestActivityAt)}
              </p>
            </Card>
          </div>

          <Card>
            <SectionTitle title="Home Department" subtitle="Change the member's home department assignment." />
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                {userDetailQuery.data.viewerCanManageMember ? (
                  <Select
                    value={homeDepartmentDraft}
                    onChange={(event) => setHomeDepartmentDraft(event.target.value)}
                    disabled={updateHomeDepartmentMutation.isPending}
                  >
                    <option value="">Unassigned</option>
                    {userDetailQuery.data.availableHomeDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-sm text-brand-moss">
                    {userDetailQuery.data.user.homeDepartmentId
                      ? userDetailQuery.data.departmentNameById[userDetailQuery.data.user.homeDepartmentId] ??
                        "Unknown department"
                      : "Unassigned"}
                  </p>
                )}
              </div>
              {userDetailQuery.data.viewerCanManageMember ? (
                <Button
                  onClick={() => updateHomeDepartmentMutation.mutate(homeDepartmentDraft || null)}
                  disabled={!homeDepartmentDirty || updateHomeDepartmentMutation.isPending}
                >
                  {updateHomeDepartmentMutation.isPending ? "Saving..." : "Save Department"}
                </Button>
              ) : null}
            </div>
            {updateHomeDepartmentMutation.error ? (
              <p className="mt-2 text-sm text-red-700">
                {updateHomeDepartmentMutation.error instanceof Error
                  ? updateHomeDepartmentMutation.error.message
                  : "Failed to update home department."}
              </p>
            ) : null}
          </Card>

          <Card>
            <SectionTitle title="Role" subtitle="Change the member's role assignment." />
            {userDetailQuery.data.viewerCanManageMember ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <Select
                    value={roleDraftId}
                    onChange={(event) => setRoleDraftId(event.target.value)}
                    disabled={rolesQuery.isLoading || updateRoleMutation.isPending}
                  >
                    <option value="">Select role</option>
                    {(rolesQuery.data ?? []).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  onClick={() => updateRoleMutation.mutate(roleDraftId)}
                  disabled={!roleDirty || !roleDraftId || updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? "Saving..." : "Save Role"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-brand-moss">{userDetailQuery.data.user.roleNames[0] ?? "Member"}</p>
            )}
            {rolesQuery.error ? (
              <p className="mt-2 text-sm text-red-700">
                {rolesQuery.error instanceof Error ? rolesQuery.error.message : "Failed to load roles."}
              </p>
            ) : null}
            {updateRoleMutation.error ? (
              <p className="mt-2 text-sm text-red-700">
                {updateRoleMutation.error instanceof Error
                  ? updateRoleMutation.error.message
                  : "Failed to update role."}
              </p>
            ) : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <SectionTitle title="Activity Log" subtitle="Logged entries for this user in your visibility scope." />
              {userDetailQuery.data.activities.length === 0 ? (
                <p className="text-sm text-brand-moss">No activity found for this user.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-brand-mist text-xs uppercase tracking-wide text-brand-moss">
                      <tr>
                        <th className="px-2 py-2">Created</th>
                        <th className="px-2 py-2">Department</th>
                        <th className="px-2 py-2">Task</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userDetailQuery.data.activities.map((activity) => (
                        <tr
                          key={activity.id}
                          className={classNames(
                            "border-b border-brand-mist/60",
                            selectedActivityId === activity.id ? "bg-[#eff6ff]" : undefined
                          )}
                        >
                          <td className="px-2 py-2">{formatDate(activity.createdAt)}</td>
                          <td className="px-2 py-2">
                            {userDetailQuery.data.departmentNameById[activity.workDepartmentId] ?? "Unknown department"}
                          </td>
                          <td className="px-2 py-2">{activity.taskTemplateName}</td>
                          <td className="px-2 py-2">
                            <Badge value={activity.status} tone={activityTone(activity.status)} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Button variant="ghost" onClick={() => setSelectedActivityId(activity.id)}>
                              {selectedActivityId === activity.id ? "Selected" : "View"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle title="Activity Actions" subtitle="Approve or reject selected activity with reason." />
              {selectedActivity ? (
                <UserActivityPanel
                  activity={selectedActivity}
                  departmentNameById={userDetailQuery.data.departmentNameById}
                  onApprove={() => approveMutation.mutateAsync(selectedActivity.id).then(() => undefined)}
                  onReject={(reason) =>
                    rejectMutation
                      .mutateAsync({ activityId: selectedActivity.id, reason })
                      .then(() => undefined)
                  }
                  disabled={
                    !selectedActivity.canReview ||
                    !["submitted", "resubmitted"].includes(selectedActivity.status) ||
                    approveMutation.isPending ||
                    rejectMutation.isPending
                  }
                />
              ) : (
                <p className="text-sm text-brand-moss">Select an activity to review details and actions.</p>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function UserActivityPanel({
  activity,
  departmentNameById,
  onApprove,
  onReject,
  disabled
}: {
  activity: TenantUserDetailActivity;
  departmentNameById: Record<string, string>;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  disabled: boolean;
}) {
  const seenKeys = new Set<string>();
  const payloadFields: Array<{ key: string; label: string; value: string }> = [];

  for (const field of activity.taskSchemaSnapshot) {
    seenKeys.add(field.key);
    payloadFields.push({
      key: field.key,
      label: field.label || humanizeKey(field.key),
      value: formatPayloadValue(activity.payload[field.key])
    });
  }

  for (const [key, value] of Object.entries(activity.payload)) {
    if (seenKeys.has(key)) {
      continue;
    }
    payloadFields.push({
      key,
      label: humanizeKey(key),
      value: formatPayloadValue(value)
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-3 text-sm">
        <p className="mt-1">
          <span className="font-semibold text-brand-slate">Department:</span>{" "}
          {departmentNameById[activity.workDepartmentId] ?? "Unknown department"}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-brand-slate">Task:</span> {activity.taskTemplateName}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-brand-slate">Created:</span> {formatDate(activity.createdAt)}
        </p>
        {activity.rejectionReason ? (
          <p className="mt-1 text-red-700">
            <span className="font-semibold">Rejection Reason:</span> {activity.rejectionReason}
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-moss">Submitted Details</p>
        {payloadFields.length ? (
          <dl className="grid gap-2 text-sm">
            {payloadFields.map((field) => (
              <div key={field.key} className="rounded-md border border-brand-mist/70 bg-white px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-brand-moss">{field.label}</dt>
                <dd className="mt-1 text-brand-slate">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-brand-moss">No additional details were submitted.</p>
        )}
      </div>

      {!activity.canReview ? (
        <p className="text-xs text-brand-moss">You can view this activity but cannot approve/reject it.</p>
      ) : null}
      {activity.canReview && !["submitted", "resubmitted"].includes(activity.status) ? (
        <p className="text-xs text-brand-moss">Only submitted or resubmitted activities can be reviewed.</p>
      ) : null}

      <ApproveRejectActions disabled={disabled} onApprove={onApprove} onReject={onReject} />
    </div>
  );
}
