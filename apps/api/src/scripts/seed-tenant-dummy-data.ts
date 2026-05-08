import { env } from "../config/env";
import { SYSTEM_ROLE_KEYS } from "../constants/default-roles";
import { getDataStore } from "../repositories";
import { tenantMembershipId } from "../services/platform/ids";
import {
  COLLECTIONS,
  type ActivityApprovalEntity,
  type ActivityEntryEntity,
  type DepartmentEntity,
  type DepartmentTaskEntity,
  type TaskFieldSchema,
  type TaskTemplateEntity,
  type TenantEntity,
  type TenantMembershipEntity,
  type TenantRoleEntity,
  type UserEntity
} from "../types/domain";
import { newId, nowIso } from "../utils/entity";

type PendingStatus = "submitted" | "resubmitted";

interface SeedOptions {
  tenantId: string;
  userCount: number;
  emailPrefix: string;
  emailDomain: string;
  targetUserId: string | null;
  targetUserEmail: string | null;
  targetUserName: string | null;
  approvedDaysBack: number;
  seedTag: string;
  includeWeekends: boolean;
  pendingStatus: PendingStatus;
}

function printUsage(): void {
  console.log("Seeds dummy users and activity logs for a tenant.");
  console.log("Creates:");
  console.log("  1) Approved logs for the previous month window");
  console.log("  2) Pending logs for the current week");
  console.log("");
  console.log("Usage:");
  console.log(
    "  npm.cmd run seed:tenant-dummy -- --tenant-id <tenantId> [--users 8] [--user-id <userId>] [--user-email <email>] [--user-name <name>] [--email-prefix demo.user] [--email-domain example.com] [--approved-days-back 30] [--seed-tag tenant-dummy-v1] [--include-weekends] [--pending-status submitted|resubmitted]"
  );
}

function parseArgs(argv: string[]): SeedOptions {
  let tenantId = "";
  let userCount = 8;
  let emailPrefix = "demo.user";
  let emailDomain = "example.com";
  let targetUserId: string | null = null;
  let targetUserEmail: string | null = null;
  let targetUserName: string | null = null;
  let approvedDaysBack = 30;
  let seedTag = "tenant-dummy-v1";
  let includeWeekends = false;
  let pendingStatus: PendingStatus = "submitted";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--tenant-id" && argv[index + 1]) {
      tenantId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--users" && argv[index + 1]) {
      userCount = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--email-prefix" && argv[index + 1]) {
      emailPrefix = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--email-domain" && argv[index + 1]) {
      emailDomain = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--user-id" && argv[index + 1]) {
      targetUserId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--user-email" && argv[index + 1]) {
      targetUserEmail = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--user-name" && argv[index + 1]) {
      targetUserName = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--approved-days-back" && argv[index + 1]) {
      approvedDaysBack = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--seed-tag" && argv[index + 1]) {
      seedTag = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--include-weekends") {
      includeWeekends = true;
      continue;
    }
    if (token === "--pending-status" && argv[index + 1]) {
      const next = argv[index + 1];
      if (next === "submitted" || next === "resubmitted") {
        pendingStatus = next;
      }
      index += 1;
      continue;
    }
    if (token === "--help") {
      printUsage();
      process.exit(0);
    }
  }

  if (!tenantId) {
    throw new Error("--tenant-id is required.");
  }
  if (!targetUserId && (!Number.isInteger(userCount) || userCount <= 0)) {
    throw new Error("--users must be a positive integer.");
  }
  if (!Number.isInteger(approvedDaysBack) || approvedDaysBack <= 0) {
    throw new Error("--approved-days-back must be a positive integer.");
  }

  return {
    tenantId,
    userCount,
    emailPrefix,
    emailDomain,
    targetUserId,
    targetUserEmail,
    targetUserName,
    approvedDaysBack,
    seedTag,
    includeWeekends,
    pendingStatus
  };
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function localDateValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + delta);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function buildDateRange(
  startInclusive: Date,
  endInclusive: Date,
  includeWeekends: boolean
): string[] {
  const dates: string[] = [];
  let current = new Date(
    startInclusive.getFullYear(),
    startInclusive.getMonth(),
    startInclusive.getDate()
  );
  const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate());

  while (current <= end) {
    if (includeWeekends || !isWeekend(current)) {
      dates.push(localDateValue(current));
    }
    current = addDays(current, 1);
  }
  return dates;
}

function valueForField(field: TaskFieldSchema, activityDate: string): unknown {
  if (field.type === "text") {
    return `${field.label} - dummy ${activityDate}`;
  }
  if (field.type === "textarea") {
    return `Auto-generated dummy value for ${field.label} on ${activityDate}.`;
  }
  if (field.type === "number") {
    const min = typeof field.min === "number" ? field.min : 1;
    const max = typeof field.max === "number" ? field.max : min + 8;
    return min <= max ? min : max;
  }
  if (field.type === "date") {
    return activityDate;
  }
  if (field.type === "checkbox") {
    return field.required ? true : false;
  }
  if (field.type === "select" || field.type === "radio") {
    if (field.options && field.options.length > 0) {
      return field.options[0];
    }
    return "Option 1";
  }
  return `${field.label} - dummy`;
}

function buildPayload(
  fields: TaskFieldSchema[],
  activityDate: string,
  seedTag: string,
  seedBucket: "approved_past_month" | "pending_current_week"
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    _seedTag: seedTag,
    _seedBucket: seedBucket
  };
  for (const field of fields) {
    payload[field.key] = valueForField(field, activityDate);
  }
  return payload;
}

function getPayloadSeedMeta(payload: Record<string, unknown>): {
  seedTag: string | null;
  seedBucket: string | null;
} {
  const seedTag =
    typeof payload._seedTag === "string" && payload._seedTag.length > 0 ? payload._seedTag : null;
  const seedBucket =
    typeof payload._seedBucket === "string" && payload._seedBucket.length > 0
      ? payload._seedBucket
      : null;
  return { seedTag, seedBucket };
}

function timestampForDate(dateKey: string, hour24: number, minute: number): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(yearRaw, monthRaw - 1, dayRaw, hour24, minute, 0, 0));
  return utcDate.toISOString();
}

async function seedTenantDummyData(options: SeedOptions): Promise<void> {
  const store = getDataStore();
  const tenant = await store.getById<TenantEntity>(COLLECTIONS.tenants, options.tenantId);
  if (!tenant || tenant.deletedAt) {
    throw new Error(`Tenant ${options.tenantId} was not found or is deleted.`);
  }

  const roles = await store.query<TenantRoleEntity>(COLLECTIONS.tenantRoles, [
    { field: "tenantId", op: "==", value: options.tenantId }
  ]);
  if (roles.length === 0) {
    throw new Error(`No roles configured for tenant ${options.tenantId}.`);
  }
  const staffRole =
    roles.find((role) => role.key === SYSTEM_ROLE_KEYS.staff) ??
    roles.find((role) => role.key !== SYSTEM_ROLE_KEYS.owner) ??
    roles[0];

  const departments = await store.query<DepartmentEntity>(COLLECTIONS.departments, [
    { field: "tenantId", op: "==", value: options.tenantId }
  ]);
  if (departments.length === 0) {
    throw new Error(`No departments configured for tenant ${options.tenantId}.`);
  }

  const departmentTasks = await store.query<DepartmentTaskEntity>(COLLECTIONS.departmentTasks, [
    { field: "tenantId", op: "==", value: options.tenantId }
  ]);
  if (departmentTasks.length === 0) {
    throw new Error(`No department task assignments found for tenant ${options.tenantId}.`);
  }

  const taskTemplateIds = [...new Set(departmentTasks.map((assignment) => assignment.taskTemplateId))];
  const templateById = new Map<string, TaskTemplateEntity>();
  for (const templateId of taskTemplateIds) {
    const template = await store.getById<TaskTemplateEntity>(COLLECTIONS.taskTemplates, templateId);
    if (template && template.tenantId === options.tenantId && template.isActive) {
      templateById.set(template.id, template);
    }
  }

  const departmentTemplates = new Map<string, TaskTemplateEntity[]>();
  for (const department of departments) {
    const templates = departmentTasks
      .filter((assignment) => assignment.departmentId === department.id)
      .map((assignment) => templateById.get(assignment.taskTemplateId))
      .filter((template): template is TaskTemplateEntity => Boolean(template));
    if (templates.length > 0) {
      departmentTemplates.set(department.id, templates);
    }
  }

  const seedableDepartments = departments.filter((department) =>
    departmentTemplates.has(department.id)
  );
  if (seedableDepartments.length === 0) {
    throw new Error(`No departments with active task templates found for tenant ${options.tenantId}.`);
  }

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const currentWeekStartKey = localDateValue(currentWeekStart);
  const currentDateKey = localDateValue(now);
  const approvedStartDate = addDays(currentWeekStart, -options.approvedDaysBack);
  const approvedEndDate = addDays(currentWeekStart, -1);

  const approvedDates = buildDateRange(approvedStartDate, approvedEndDate, options.includeWeekends);
  const pendingDates = buildDateRange(currentWeekStart, now, options.includeWeekends);
  const reviewerId = tenant.ownerIds[0] ?? "system";

  let usersCreated = 0;
  let membershipsCreated = 0;
  let approvedCreated = 0;
  let approvedSkipped = 0;
  let pendingCreated = 0;
  let pendingSkipped = 0;

  const targetUsers: Array<{ userId: string; email: string; name: string }> = options.targetUserId
    ? [
        {
          userId: options.targetUserId,
          email:
            options.targetUserEmail ??
            `${options.targetUserId.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase() || "seeded.user"}@${
              options.emailDomain
            }`,
          name: options.targetUserName ?? `Seeded User ${options.targetUserId.slice(0, 12)}`
        }
      ]
    : Array.from({ length: options.userCount }, (_, userIndex) => {
        const sequence = String(userIndex + 1).padStart(3, "0");
        return {
          userId: `${options.tenantId}:dummy:${sequence}`,
          email: `${options.emailPrefix}${sequence}@${options.emailDomain}`,
          name: `Dummy User ${pad2(userIndex + 1)}`
        };
      });

  for (let userIndex = 0; userIndex < targetUsers.length; userIndex += 1) {
    const targetUser = targetUsers[userIndex];
    const userId = targetUser.userId;
    const email = targetUser.email;

    const existingUser = await store.getById<UserEntity>(COLLECTIONS.users, userId);
    if (!existingUser) {
      const timestamp = nowIso();
      const user: UserEntity = {
        id: userId,
        email,
        name: targetUser.name,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await store.create(COLLECTIONS.users, user);
      usersCreated += 1;
    }

    const membershipId = tenantMembershipId(options.tenantId, userId);
    const existingMembership = await store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membershipId
    );
    const membershipHomeDepartmentId = existingMembership?.homeDepartmentId;
    const membershipDepartment = membershipHomeDepartmentId
      ? seedableDepartments.find((department) => department.id === membershipHomeDepartmentId) ?? null
      : null;
    const department = membershipDepartment ?? seedableDepartments[userIndex % seedableDepartments.length];
    const templates = departmentTemplates.get(department.id)!;

    if (!existingMembership) {
      const timestamp = nowIso();
      const membership: TenantMembershipEntity = {
        id: membershipId,
        tenantId: options.tenantId,
        userId,
        status: "active",
        roleIds: [staffRole.id],
        homeDepartmentId: department.id,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await store.set(COLLECTIONS.tenantMemberships, membership.id, membership);
      membershipsCreated += 1;
    }

    const allUserEntries = await store.query<ActivityEntryEntity>(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: options.tenantId },
      { field: "userId", op: "==", value: userId }
    ]);

    const seededKeySet = new Set<string>();
    for (const entry of allUserEntries) {
      const { seedTag, seedBucket } = getPayloadSeedMeta(entry.payload);
      if (!seedTag || !seedBucket) {
        continue;
      }
      seededKeySet.add(`${seedTag}|${seedBucket}|${entry.activityDate}`);
    }

    for (let dateIndex = 0; dateIndex < approvedDates.length; dateIndex += 1) {
      const activityDate = approvedDates[dateIndex];
      const dedupeKey = `${options.seedTag}|approved_past_month|${activityDate}`;
      if (seededKeySet.has(dedupeKey)) {
        approvedSkipped += 1;
        continue;
      }

      const template = templates[dateIndex % templates.length];
      const createdAt = timestampForDate(activityDate, 16, 30);
      const submittedAt = timestampForDate(activityDate, 17, 0);
      const reviewedAt = timestampForDate(activityDate, 18, 15);
      const entry: ActivityEntryEntity = {
        id: newId(),
        tenantId: options.tenantId,
        userId,
        homeDepartmentId: department.id,
        workDepartmentId: department.id,
        taskTemplateId: template.id,
        taskTemplateName: template.name,
        taskTemplateVersion: template.version,
        activityDate,
        startTime: "10:00",
        endTime: "11:30",
        taskSchemaSnapshot: template.fields,
        payload: buildPayload(
          template.fields,
          activityDate,
          options.seedTag,
          "approved_past_month"
        ),
        status: "approved",
        submittedAt,
        reviewedAt,
        reviewedBy: reviewerId,
        rejectionReason: null,
        createdAt,
        updatedAt: reviewedAt
      };
      await store.create(COLLECTIONS.activityEntries, entry);

      const approval: ActivityApprovalEntity = {
        id: newId(),
        tenantId: options.tenantId,
        activityId: entry.id,
        action: "approve",
        actionBy: reviewerId,
        reason: null,
        createdAt: reviewedAt,
        updatedAt: reviewedAt
      };
      await store.create(COLLECTIONS.activityApprovals, approval);

      seededKeySet.add(dedupeKey);
      approvedCreated += 1;
    }

    for (let dateIndex = 0; dateIndex < pendingDates.length; dateIndex += 1) {
      const activityDate = pendingDates[dateIndex];
      const dedupeKey = `${options.seedTag}|pending_current_week|${activityDate}`;
      if (seededKeySet.has(dedupeKey)) {
        pendingSkipped += 1;
        continue;
      }

      const template = templates[dateIndex % templates.length];
      const createdAt = timestampForDate(activityDate, 13, 0);
      const submittedAt = timestampForDate(activityDate, 13, 20);
      const entry: ActivityEntryEntity = {
        id: newId(),
        tenantId: options.tenantId,
        userId,
        homeDepartmentId: department.id,
        workDepartmentId: department.id,
        taskTemplateId: template.id,
        taskTemplateName: template.name,
        taskTemplateVersion: template.version,
        activityDate,
        startTime: "14:00",
        endTime: "15:00",
        taskSchemaSnapshot: template.fields,
        payload: buildPayload(
          template.fields,
          activityDate,
          options.seedTag,
          "pending_current_week"
        ),
        status: options.pendingStatus,
        submittedAt,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        createdAt,
        updatedAt: submittedAt
      };
      await store.create(COLLECTIONS.activityEntries, entry);
      seededKeySet.add(dedupeKey);
      pendingCreated += 1;
    }
  }

  console.log(`Data provider: ${env.DATA_PROVIDER}`);
  console.log(`Tenant: ${options.tenantId}`);
  console.log(`Current week start: ${currentWeekStartKey}`);
  console.log(`Current date: ${currentDateKey}`);
  console.log(
    `Approved window: ${localDateValue(approvedStartDate)} to ${localDateValue(approvedEndDate)}`
  );
  console.log(`Pending window: ${currentWeekStartKey} to ${currentDateKey}`);
  console.log(`Users targeted: ${targetUsers.length}`);
  if (options.targetUserId) {
    console.log(`Target user id: ${options.targetUserId}`);
  }
  console.log(`Users created: ${usersCreated}`);
  console.log(`Memberships created: ${membershipsCreated}`);
  console.log(`Approved logs created: ${approvedCreated}`);
  console.log(`Approved logs skipped: ${approvedSkipped}`);
  console.log(`Pending logs created: ${pendingCreated}`);
  console.log(`Pending logs skipped: ${pendingSkipped}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await seedTenantDummyData(options);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to seed tenant dummy data: ${message}`);
  process.exit(1);
});
