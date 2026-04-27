"use client";

import type { ActivityEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui/primitives";

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

function toStatusTone(status: ActivityEntry["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
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

function toTitleCase(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderTimestamp(value: string | null): string {
  if (!value) {
    return "Not available";
  }
  return formatDate(value);
}

export function ActivityDetailDrawer({
  activity,
  onClose,
  actions,
  ownerName,
  ownerEmail,
  departmentName,
  variant = "card",
  showCloseButton = true
}: {
  activity: ActivityEntry | null;
  onClose: () => void;
  actions?: React.ReactNode;
  ownerName?: string;
  ownerEmail?: string;
  departmentName?: string;
  variant?: "card" | "plain";
  showCloseButton?: boolean;
}) {
  if (!activity) {
    if (variant === "plain") {
      return <p className="text-sm text-brand-moss">Select an activity to inspect details.</p>;
    }
    return <Card className="h-full"><p className="text-sm text-brand-moss">Select an activity to inspect details.</p></Card>;
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

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-mist/70 pb-4">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
            Activity Details
          </h3>
          <p className="mt-1 text-sm text-brand-moss">{activity.taskTemplateName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={toTitleCase(activity.status)} tone={toStatusTone(activity.status)} />
        </div>
        {showCloseButton ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Owner</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{ownerName ?? activity.userId}</p>
          <p className="text-xs text-brand-moss">{ownerEmail ?? "Email unavailable"}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Department</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">
            {departmentName ?? "Unknown department"}
          </p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Activity Date</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{activity.activityDate}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Time</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">
            {activity.startTime} - {activity.endTime}
          </p>
          <p className="text-xs text-brand-moss">{formatDuration(activity.startTime, activity.endTime)}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Created</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{renderTimestamp(activity.createdAt)}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Submitted</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{renderTimestamp(activity.submittedAt)}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Reviewed</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{renderTimestamp(activity.reviewedAt)}</p>
        </div>
        <div className="rounded-lg border border-brand-mist/70 bg-[#f8fafc] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-moss">Updated</p>
          <p className="mt-1 text-sm font-semibold text-brand-slate">{renderTimestamp(activity.updatedAt)}</p>
        </div>
      </div>

      {activity.rejectionReason ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-red-700">Rejection Reason</p>
          <p className="mt-1 text-sm text-red-800">{activity.rejectionReason}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">Submitted Details</h4>
        {fieldRows.length ? (
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {fieldRows.map((field) => (
              <div
                key={field.key}
                className="rounded-lg border border-brand-mist/70 bg-white px-3 py-2"
              >
                <dt className="text-xs uppercase tracking-wide text-brand-moss">{field.label}</dt>
                <dd className="mt-1 text-sm text-brand-slate break-words whitespace-pre-wrap">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-brand-moss">No additional details were submitted.</p>
        )}
      </div>

      {actions ? (
        <div className="mt-5 rounded-lg border border-brand-mist/70 bg-[#f8fafc] p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-moss">Actions</h4>
          <p className="mt-1 text-sm text-brand-moss">Approve or reject this entry.</p>
          <div className="mt-3">{actions}</div>
        </div>
      ) : null}
    </>
  );

  if (variant === "plain") {
    return <div className="h-full p-6">{content}</div>;
  }

  return <Card className="h-full">{content}</Card>;
}
