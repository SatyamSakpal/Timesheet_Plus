"use client";

import type { ActivityEntry } from "@/lib/types";
import { Badge, Button } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

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
  usersById
}: {
  activities: ActivityEntry[];
  onSelect: (activity: ActivityEntry) => void;
  selectedActivityId?: string;
  usersById: Map<string, { id: string; name: string; email: string }>;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-brand-moss">No activities found for selected filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-mist text-left text-xs uppercase tracking-wide text-brand-moss">
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Duration</th>
            <th className="px-2 py-2">Task</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Created</th>
            <th className="px-2 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const owner = usersById.get(activity.userId);
            return (
              <tr key={activity.id} className="border-b border-brand-mist/50">
                <td className="px-2 py-2">{activity.activityDate}</td>
                <td className="px-2 py-2 text-xs text-brand-moss">
                  {activity.startTime} - {activity.endTime}
                </td>
                <td className="px-2 py-2">{activity.taskTemplateName}</td>
                <td className="px-2 py-2">
                  <p className="font-medium text-brand-slate">{owner?.name ?? activity.userId}</p>
                  <p className="text-xs text-brand-moss">{owner?.email ?? "Email unavailable"}</p>
                </td>
                <td className="px-2 py-2">
                  <Badge value={activity.status} tone={toTone(activity.status)} />
                </td>
                <td className="px-2 py-2 text-xs text-brand-moss">{formatDate(activity.createdAt)}</td>
                <td className="px-2 py-2">
                  <Button
                    variant={selectedActivityId === activity.id ? "secondary" : "ghost"}
                    onClick={() => onSelect(activity)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
