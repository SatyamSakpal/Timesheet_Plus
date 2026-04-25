import { badRequest, forbidden } from "../../errors/app-error";
import {
  COLLECTIONS,
  type ActivityEntryEntity,
  type ActivityStatus,
  type AuthenticatedUser
} from "../../types/domain";
import { nowIso, newId } from "../../utils/entity";
import { validateTaskPayload } from "../../utils/task-payload-validator";
import { TaskService } from "./task.service";

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

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/**
 * Activity lifecycle concerns:
 * - create/submit activity entries
 * - department-scoped listing
 * - HOD-driven approval/rejection
 * - user resubmission after rejection
 */
export class ActivityService extends TaskService {
  async createActivity(
    tenantId: string,
    actor: AuthenticatedUser,
    input: {
      workDepartmentId: string;
      taskTemplateId: string;
      activityDate: string;
      startTime: string;
      endTime: string;
      payload: Record<string, unknown>;
      status: Extract<ActivityStatus, "draft" | "submitted">;
    }
  ): Promise<ActivityEntryEntity> {
    const membership = await this.getActiveTenantMembershipOrThrow(tenantId, actor.uid);
    await this.getDepartmentOrThrow(tenantId, input.workDepartmentId);
    await this.assertTaskAssignedToDepartment(tenantId, input.workDepartmentId, input.taskTemplateId);

    const template = await this.getTaskTemplateOrThrow(tenantId, input.taskTemplateId);
    // Draft can be partial, submitted must satisfy all required fields.
    validateTaskPayload(template.fields, input.payload, input.status !== "draft");
    await this.assertNoTimeOverlap(tenantId, actor.uid, input.activityDate, input.startTime, input.endTime);

    const timestamp = nowIso();
    const activity: ActivityEntryEntity = {
      id: newId(),
      tenantId,
      userId: actor.uid,
      homeDepartmentId: membership.homeDepartmentId,
      workDepartmentId: input.workDepartmentId,
      taskTemplateId: template.id,
      taskTemplateName: template.name,
      taskTemplateVersion: template.version,
      activityDate: input.activityDate,
      startTime: input.startTime,
      endTime: input.endTime,
      taskSchemaSnapshot: template.fields,
      payload: input.payload,
      status: input.status,
      submittedAt: input.status === "draft" ? null : timestamp,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.activityEntries, activity);
    await this.createAuditLog(tenantId, actor.uid, "activity.create", "activity", activity.id, {
      workDepartmentId: input.workDepartmentId,
      taskTemplateId: input.taskTemplateId,
      activityDate: input.activityDate,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status
    });
    return activity;
  }

  async listMyActivities(
    tenantId: string,
    userId: string,
    filters: {
      status?: ActivityStatus;
      departmentId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<ActivityEntryEntity[]> {
    await this.getActiveTenantMembershipOrThrow(tenantId, userId);
    const activities = await this.store.query<ActivityEntryEntity>(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "userId", op: "==", value: userId }
    ]);

    return activities
      .filter((activity) => !filters.status || activity.status === filters.status)
      .filter((activity) => !filters.departmentId || activity.workDepartmentId === filters.departmentId)
      .filter((activity) => !filters.dateFrom || activity.createdAt >= filters.dateFrom)
      .filter((activity) => !filters.dateTo || activity.createdAt <= filters.dateTo)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listDepartmentActivities(
    tenantId: string,
    departmentId: string,
    filters: {
      status?: ActivityStatus;
      userId?: string;
      taskTemplateId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<ActivityEntryEntity[]> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const activities = await this.store.query<ActivityEntryEntity>(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "workDepartmentId", op: "==", value: departmentId }
    ]);

    return activities
      .filter((activity) => !filters.status || activity.status === filters.status)
      .filter((activity) => !filters.userId || activity.userId === filters.userId)
      .filter(
        (activity) => !filters.taskTemplateId || activity.taskTemplateId === filters.taskTemplateId
      )
      .filter((activity) => !filters.dateFrom || activity.createdAt >= filters.dateFrom)
      .filter((activity) => !filters.dateTo || activity.createdAt <= filters.dateTo)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async approveActivity(
    tenantId: string,
    activityId: string,
    actorUserId: string
  ): Promise<ActivityEntryEntity> {
    const activity = await this.getActivityOrThrow(tenantId, activityId);
    if (!["submitted", "resubmitted"].includes(activity.status)) {
      badRequest("Only submitted/resubmitted entries can be approved");
    }
    const timestamp = nowIso();
    const next = await this.store.update<ActivityEntryEntity>(
      COLLECTIONS.activityEntries,
      activity.id,
      {
        status: "approved",
        reviewedAt: timestamp,
        reviewedBy: actorUserId,
        rejectionReason: null,
        updatedAt: timestamp
      }
    );
    await this.createActivityApproval(tenantId, activity.id, "approve", actorUserId, null);
    await this.createAuditLog(tenantId, actorUserId, "activity.approve", "activity", activity.id, {
      workDepartmentId: activity.workDepartmentId
    });
    return next;
  }

  async rejectActivity(
    tenantId: string,
    activityId: string,
    actorUserId: string,
    reason: string
  ): Promise<ActivityEntryEntity> {
    const activity = await this.getActivityOrThrow(tenantId, activityId);
    if (!["submitted", "resubmitted"].includes(activity.status)) {
      badRequest("Only submitted/resubmitted entries can be rejected");
    }
    const timestamp = nowIso();
    const next = await this.store.update<ActivityEntryEntity>(
      COLLECTIONS.activityEntries,
      activity.id,
      {
        status: "rejected",
        reviewedAt: timestamp,
        reviewedBy: actorUserId,
        rejectionReason: reason,
        updatedAt: timestamp
      }
    );
    await this.createActivityApproval(tenantId, activity.id, "reject", actorUserId, reason);
    await this.createAuditLog(tenantId, actorUserId, "activity.reject", "activity", activity.id, {
      reason
    });
    return next;
  }

  async resubmitActivity(
    tenantId: string,
    activityId: string,
    actorUserId: string,
    payload?: Record<string, unknown>
  ): Promise<ActivityEntryEntity> {
    const activity = await this.getActivityOrThrow(tenantId, activityId);
    if (activity.userId !== actorUserId) {
      forbidden("Only creator can resubmit this activity");
    }
    if (activity.status !== "rejected") {
      badRequest("Only rejected entries can be resubmitted");
    }
    const nextPayload = payload ?? activity.payload;
    validateTaskPayload(activity.taskSchemaSnapshot, nextPayload, true);

    const timestamp = nowIso();
    const next = await this.store.update<ActivityEntryEntity>(
      COLLECTIONS.activityEntries,
      activity.id,
      {
        payload: nextPayload,
        status: "resubmitted",
        submittedAt: timestamp,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        updatedAt: timestamp
      }
    );
    await this.createAuditLog(
      tenantId,
      actorUserId,
      "activity.resubmit",
      "activity",
      activity.id,
      {}
    );
    return next;
  }

  async deleteOwnPendingActivity(
    tenantId: string,
    activityId: string,
    actorUserId: string
  ): Promise<void> {
    const activity = await this.getActivityOrThrow(tenantId, activityId);
    if (activity.userId !== actorUserId) {
      forbidden("Only creator can delete this activity");
    }
    if (!["submitted", "resubmitted"].includes(activity.status)) {
      badRequest("Only submitted or resubmitted entries can be deleted");
    }

    await this.store.delete(COLLECTIONS.activityEntries, activity.id);
    await this.createAuditLog(tenantId, actorUserId, "activity.delete", "activity", activity.id, {
      status: activity.status,
      workDepartmentId: activity.workDepartmentId
    });
  }

  private async assertNoTimeOverlap(
    tenantId: string,
    userId: string,
    activityDate: string,
    startTime: string,
    endTime: string
  ): Promise<void> {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (start === null || end === null || end <= start) {
      return;
    }

    const sameDayActivities = await this.store.query<ActivityEntryEntity>(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "userId", op: "==", value: userId },
      { field: "activityDate", op: "==", value: activityDate }
    ]);

    const overlaps = sameDayActivities
      .filter((activity) => activity.status !== "rejected")
      .filter((activity) => {
        const existingStart = parseTimeToMinutes(activity.startTime);
        const existingEnd = parseTimeToMinutes(activity.endTime);
        if (existingStart === null || existingEnd === null || existingEnd <= existingStart) {
          return false;
        }
        return rangesOverlap(start, end, existingStart, existingEnd);
      })
      .sort((left, right) => (left.startTime < right.startTime ? -1 : 1));

    if (overlaps.length === 0) {
      return;
    }

    const overlapSummary = overlaps
      .slice(0, 3)
      .map((activity) => `${activity.taskTemplateName} (${activity.startTime}-${activity.endTime})`)
      .join(", ");
    badRequest(`Time range overlaps with existing activity on ${activityDate}: ${overlapSummary}`);
  }
}
