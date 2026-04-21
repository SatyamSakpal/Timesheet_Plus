"use client";

import type { ActivityEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";

export function ActivityDetailDrawer({
  activity,
  onClose
}: {
  activity: ActivityEntry | null;
  onClose: () => void;
}) {
  if (!activity) {
    return (
      <Card className="h-full">
        <p className="text-sm text-brand-moss">Select an activity to inspect payload details.</p>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-semibold text-brand-slate">Activity Details</h3>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Activity ID</dt>
          <dd className="font-mono text-xs text-brand-slate">{activity.id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">User</dt>
          <dd>{activity.userId}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Task</dt>
          <dd>{activity.taskTemplateName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Status</dt>
          <dd>{activity.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Created</dt>
          <dd>{formatDate(activity.createdAt)}</dd>
        </div>
        {activity.rejectionReason ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-brand-moss">Rejection Reason</dt>
            <dd>{activity.rejectionReason}</dd>
          </div>
        ) : null}
      </dl>
      <pre className="mt-4 max-h-[280px] overflow-auto rounded-md bg-brand-slate p-3 text-xs text-white">
        {JSON.stringify(activity.payload, null, 2)}
      </pre>
    </Card>
  );
}
