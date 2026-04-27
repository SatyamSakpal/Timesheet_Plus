import { FIELD_CATALOG_SEED, PERMISSION_CATALOG_SEED } from "../../constants/master-catalog";
import {
  PRESET_DEPARTMENT_CATALOG_SEED,
  PRESET_TASK_TEMPLATE_CATALOG_SEED
} from "../../constants/preset-catalog";
import { badRequest, forbidden, notFound } from "../../errors/app-error";
import type { IDataStore } from "../../repositories/data-store";
import {
  COLLECTIONS,
  type ActivityApprovalEntity,
  type ActivityEntryEntity,
  type AuditLogEntity,
  type AuthenticatedUser,
  type DepartmentEntity,
  type FieldCatalogEntity,
  type FieldType,
  type PermissionCatalogEntity,
  type PresetDepartmentCatalogEntity,
  type PresetTaskTemplateCatalogEntity,
  type TaskTemplateEntity,
  type TenantEntity,
  type TenantMembershipEntity,
  type UserEntity
} from "../../types/domain";
import { nowIso, newId } from "../../utils/entity";
import { tenantMembershipId } from "./ids";

/**
 * Shared primitives for all platform services:
 * - entity lookups
 * - audit log writes
 * - common user/membership helpers
 */
export class PlatformCoreService {
  private masterCatalogSeeded = false;

  constructor(protected readonly store: IDataStore) {}

  async upsertUserProfile(user: AuthenticatedUser): Promise<UserEntity> {
    const timestamp = nowIso();
    const existing = await this.store.getById<UserEntity>(COLLECTIONS.users, user.uid);
    if (existing) {
      const existingName = existing.name.trim();
      const next = {
        ...existing,
        email: user.email,
        name: existingName.length > 0 ? existing.name : user.name,
        updatedAt: timestamp
      };
      await this.store.set(COLLECTIONS.users, next.id, next);
      return next;
    }

    const created: UserEntity = {
      id: user.uid,
      email: user.email,
      name: user.name,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.users, created);
    return created;
  }

  async createAuditLog(
    tenantId: string,
    actorUserId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>
  ): Promise<AuditLogEntity> {
    const timestamp = nowIso();
    const auditLog: AuditLogEntity = {
      id: newId(),
      tenantId,
      actorUserId,
      action,
      resourceType,
      resourceId,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.auditLogs, auditLog);
    return auditLog;
  }

  async getTenantOrThrow(tenantId: string): Promise<TenantEntity> {
    const tenant = await this.store.getById<TenantEntity>(COLLECTIONS.tenants, tenantId);
    if (!tenant || tenant.deletedAt) {
      notFound("Tenant not found");
    }
    return tenant;
  }

  async getDepartmentOrThrow(tenantId: string, departmentId: string): Promise<DepartmentEntity> {
    const department = await this.store.getById<DepartmentEntity>(
      COLLECTIONS.departments,
      departmentId
    );
    if (!department || department.tenantId !== tenantId) {
      notFound("Department not found");
    }
    return department;
  }

  async getTaskTemplateOrThrow(tenantId: string, taskTemplateId: string): Promise<TaskTemplateEntity> {
    const template = await this.store.getById<TaskTemplateEntity>(
      COLLECTIONS.taskTemplates,
      taskTemplateId
    );
    if (!template || template.tenantId !== tenantId) {
      notFound("Task template not found");
    }
    return template;
  }

  async getActivityOrThrow(tenantId: string, activityId: string): Promise<ActivityEntryEntity> {
    const entry = await this.store.getById<ActivityEntryEntity>(COLLECTIONS.activityEntries, activityId);
    if (!entry || entry.tenantId !== tenantId) {
      notFound("Activity not found");
    }
    return entry;
  }

  async getActiveTenantMembershipOrThrow(
    tenantId: string,
    userId: string
  ): Promise<TenantMembershipEntity> {
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, userId)
    );
    if (!membership || membership.status !== "active") {
      forbidden("Active tenant membership required");
    }
    return membership;
  }

  async listPermissionCatalog(): Promise<PermissionCatalogEntity[]> {
    await this.ensureMasterCatalogs();
    return this.store.query<PermissionCatalogEntity>(
      COLLECTIONS.permissionCatalog,
      [],
      { orderBy: "module", direction: "asc" }
    );
  }

  async listFieldCatalog(): Promise<FieldCatalogEntity[]> {
    await this.ensureMasterCatalogs();
    return this.store.query<FieldCatalogEntity>(
      COLLECTIONS.fieldCatalog,
      [],
      { orderBy: "order", direction: "asc" }
    );
  }

  protected async listPresetDepartmentCatalog(): Promise<PresetDepartmentCatalogEntity[]> {
    await this.ensureMasterCatalogs();
    const entries = await this.store.query<PresetDepartmentCatalogEntity>(
      COLLECTIONS.presetDepartmentsCatalog,
      []
    );
    return entries
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  protected async listPresetTaskTemplateCatalog(): Promise<PresetTaskTemplateCatalogEntity[]> {
    await this.ensureMasterCatalogs();
    const entries = await this.store.query<PresetTaskTemplateCatalogEntity>(
      COLLECTIONS.presetTaskTemplatesCatalog,
      []
    );
    return entries
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  protected async createActivityApproval(
    tenantId: string,
    activityId: string,
    action: ActivityApprovalEntity["action"],
    actionBy: string,
    reason: string | null
  ): Promise<ActivityApprovalEntity> {
    const timestamp = nowIso();
    const approval: ActivityApprovalEntity = {
      id: newId(),
      tenantId,
      activityId,
      action,
      actionBy,
      reason,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.activityApprovals, approval);
    return approval;
  }

  protected async getUsersByIds(userIds: string[]): Promise<UserEntity[]> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return [];
    }
    const users = await Promise.all(
      uniqueIds.map((userId) => this.store.getById<UserEntity>(COLLECTIONS.users, userId))
    );
    return users.filter((user): user is UserEntity => Boolean(user));
  }

  protected async ensureMasterCatalogs(): Promise<void> {
    if (this.masterCatalogSeeded) {
      return;
    }

    const timestamp = nowIso();
    for (const seed of PERMISSION_CATALOG_SEED) {
      const existing = await this.store.getById<PermissionCatalogEntity>(
        COLLECTIONS.permissionCatalog,
        seed.key
      );
      if (existing) {
        continue;
      }
      const entry: PermissionCatalogEntity = {
        id: seed.key,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        module: seed.module,
        configurable: seed.configurable,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.permissionCatalog, entry);
    }

    for (const seed of FIELD_CATALOG_SEED) {
      const existing = await this.store.getById<FieldCatalogEntity>(
        COLLECTIONS.fieldCatalog,
        seed.key
      );
      if (existing) {
        continue;
      }
      const entry: FieldCatalogEntity = {
        id: seed.key,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        supportsOptions: seed.supportsOptions,
        supportsNumericRange: seed.supportsNumericRange,
        configurable: seed.configurable,
        order: seed.order,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.fieldCatalog, entry);
    }

    for (const seed of PRESET_DEPARTMENT_CATALOG_SEED) {
      const existing = await this.store.getById<PresetDepartmentCatalogEntity>(
        COLLECTIONS.presetDepartmentsCatalog,
        seed.key
      );
      if (existing) {
        continue;
      }
      const entry: PresetDepartmentCatalogEntity = {
        id: seed.key,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        order: seed.order,
        isActive: seed.isActive,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.presetDepartmentsCatalog, entry);
    }

    for (const seed of PRESET_TASK_TEMPLATE_CATALOG_SEED) {
      const existing = await this.store.getById<PresetTaskTemplateCatalogEntity>(
        COLLECTIONS.presetTaskTemplatesCatalog,
        seed.key
      );
      if (existing) {
        continue;
      }
      const entry: PresetTaskTemplateCatalogEntity = {
        id: seed.key,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        order: seed.order,
        isActive: seed.isActive,
        assignedDepartmentKeys: seed.assignedDepartmentKeys,
        fields: seed.fields,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.presetTaskTemplatesCatalog, entry);
    }

    this.masterCatalogSeeded = true;
  }

  protected async assertPermissionKeysConfigured(permissionKeys: string[]): Promise<void> {
    const catalog = await this.listPermissionCatalog();
    const available = new Set(catalog.map((entry) => entry.key));
    for (const permission of permissionKeys) {
      if (!available.has(permission)) {
        badRequest(`Permission key is not configured: ${permission}`);
      }
    }
  }

  protected async assertFieldTypesConfigured(fieldTypes: FieldType[]): Promise<void> {
    const catalog = await this.listFieldCatalog();
    const available = new Set(catalog.map((entry) => entry.key));
    for (const fieldType of fieldTypes) {
      if (!available.has(fieldType)) {
        badRequest(`Field type is not configured: ${fieldType}`);
      }
    }
  }
}
