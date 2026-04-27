"use client";

import type { ActivityEntry } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";

function toTone(status: ActivityEntry["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
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

export function ReviewTable({
  activities,
  onSelect,
  selectedActivityId,
  usersById,
  departmentNameById,
  selectedActivityIds,
  selectableActivityIds,
  onToggleActivitySelection,
  onToggleSelectAllActivities,
  selectionMode = false
}: {
  activities: ActivityEntry[];
  onSelect: (activity: ActivityEntry) => void;
  selectedActivityId?: string;
  usersById: Map<string, { id: string; name: string; email: string }>;
  departmentNameById: Map<string, string>;
  selectedActivityIds: string[];
  selectableActivityIds: string[];
  onToggleActivitySelection: (activityId: string) => void;
  onToggleSelectAllActivities: () => void;
  selectionMode?: boolean;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-brand-moss">No activities found for selected filters.</p>;
  }

  const selectableIds = new Set(selectableActivityIds);
  const selectedIds = new Set(selectedActivityIds);
  const selectedSelectableCount = selectableActivityIds.filter((activityId) =>
    selectedIds.has(activityId)
  ).length;
  const allSelectableSelected =
    selectableActivityIds.length > 0 && selectedSelectableCount === selectableActivityIds.length;
  const partiallySelectableSelected =
    selectedSelectableCount > 0 && selectedSelectableCount < selectableActivityIds.length;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-mist text-left text-xs uppercase tracking-wide text-brand-moss">
            {selectionMode ? (
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all reviewable activities"
                  checked={allSelectableSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = partiallySelectableSelected;
                    }
                  }}
                  disabled={selectableActivityIds.length === 0}
                  onChange={() => onToggleSelectAllActivities()}
                />
              </th>
            ) : null}
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Duration</th>
            <th className="px-2 py-2">Task</th>
            <th className="px-2 py-2">Department</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const owner = usersById.get(activity.userId);
            const isSelectable = selectableIds.has(activity.id);
            return (
              <tr
                key={activity.id}
                role="button"
                tabIndex={0}
                aria-label={
                  selectionMode
                    ? `Select activity ${activity.taskTemplateName} on ${activity.activityDate}`
                    : `Open activity ${activity.taskTemplateName} on ${activity.activityDate}`
                }
                className={`border-b border-brand-mist/50 cursor-pointer transition hover:bg-brand-mist/20 ${
                  selectedActivityId === activity.id ? "bg-brand-mist/30" : ""
                }`}
                onClick={() => {
                  if (selectionMode) {
                    if (!isSelectable) {
                      return;
                    }
                    onToggleActivitySelection(activity.id);
                    return;
                  }
                  onSelect(activity);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (selectionMode) {
                      if (!isSelectable) {
                        return;
                      }
                      onToggleActivitySelection(activity.id);
                      return;
                    }
                    onSelect(activity);
                  }
                }}
              >
                {selectionMode ? (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select activity ${activity.taskTemplateName}`}
                      checked={selectedIds.has(activity.id)}
                      disabled={!isSelectable}
                      onChange={() => onToggleActivitySelection(activity.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                ) : null}
                <td className="px-2 py-2">{activity.activityDate}</td>
                <td className="px-2 py-2 text-xs text-brand-moss">
                  {activity.startTime} - {activity.endTime}
                </td>
                <td className="px-2 py-2">{activity.taskTemplateName}</td>
                <td className="px-2 py-2 text-xs text-brand-moss">
                  {departmentNameById.get(activity.workDepartmentId) ?? "Unknown department"}
                </td>
                <td className="px-2 py-2">
                  <p className="font-medium text-brand-slate">{owner?.name ?? activity.userId}</p>
                  <p className="text-xs text-brand-moss">{owner?.email ?? "Email unavailable"}</p>
                </td>
                <td className="px-2 py-2">
                  <Badge value={activity.status} tone={toTone(activity.status)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
