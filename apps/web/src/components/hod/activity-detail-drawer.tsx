"use client";

import type { ActivityEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";

function parseTimeToMinutes(value: string): number | null {
  if (!value || !value.includes(":")) {
    return null;
  }
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatDuration(startTime: string, endTime: string): string {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return "0m";
  }
  const minutes = end - start;
  const hoursPart = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;
  if (hoursPart === 0) {
    return `${minutesPart}m`;
  }
  if (minutesPart === 0) {
    return `${hoursPart}h`;
  }
  return `${hoursPart}h ${minutesPart}m`;
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
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "Not provided";
    }
    return entries
      .map(([key, nestedValue]) => `${humanizeKey(key)}: ${formatPayloadValue(nestedValue)}`)
      .join("; ");
  }
  return String(value);
}

export function ActivityDetailDrawer({
  activity,
  onClose,
  actions
}: {
  activity: ActivityEntry | null;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  if (!activity) {
    return (
      <Card className="h-full">
        <p className="text-sm text-brand-moss">Select an activity to inspect details.</p>
      </Card>
    );
  }

  const seenKeys = new Set<string>();
  const fieldRows: Array<{ key: string; label: string; value: string }> = [];

  for (const field of activity.taskSchemaSnapshot) {
    seenKeys.add(field.key);
    fieldRows.push({
      key: field.key,
      label: field.label || humanizeKey(field.key),
      value: formatPayloadValue(activity.payload[field.key])
    });
  }

  for (const [key, value] of Object.entries(activity.payload)) {
    if (seenKeys.has(key)) {
      continue;
    }
    fieldRows.push({
      key,
      label: humanizeKey(key),
      value: formatPayloadValue(value)
    });
  }

  return (
    <Card className="h-full">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-semibold text-brand-slate">Activity Details</h3>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
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
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Date</dt>
          <dd>{activity.activityDate}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-moss">Time</dt>
          <dd>
            {activity.startTime} - {activity.endTime} ({formatDuration(activity.startTime, activity.endTime)})
          </dd>
        </div>
        {activity.rejectionReason ? (
          <div className="md:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-brand-moss">Rejection Reason</dt>
            <dd>{activity.rejectionReason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">Submitted Details</h4>
        {fieldRows.length ? (
          <dl className="mt-2 grid gap-2 text-sm">
            {fieldRows.map((field) => (
              <div key={field.key} className="rounded-md border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-brand-moss">{field.label}</dt>
                <dd className="mt-1 text-brand-slate">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-brand-moss">No additional details were submitted.</p>
        )}
      </div>

      {actions ? (
        <div className="mt-5 border-t border-brand-mist/70 pt-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">Actions</h4>
          <p className="mt-1 text-sm text-brand-moss">Approve or reject this entry.</p>
          <div className="mt-3">{actions}</div>
        </div>
      ) : null}
    </Card>
  );
}
