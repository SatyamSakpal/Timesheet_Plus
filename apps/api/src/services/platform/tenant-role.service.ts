import { ALL_PERMISSION_KEYS } from "../../constants/permissions";
import {
  DEFAULT_TENANT_ROLES,
  SYSTEM_ROLE_KEYS
} from "../../constants/default-roles";
import { badRequest, forbidden, notFound } from "../../errors/app-error";
import {
  COLLECTIONS,
  type AuthenticatedUser,
  type DepartmentEntity,
  type DepartmentTaskEntity,
  type PresetTaskTemplateCatalogEntity,
  type TaskTemplateEntity,
  type TenantContext,
  type TenantEntity,
  type TenantInviteEntity,
  type TenantMembershipEntity,
  type TenantRoleEntity,
  type UserEntity
} from "../../types/domain";
import { nowIso, newId } from "../../utils/entity";
import { PlatformCoreService } from "./core.service";
import { tenantMembershipId } from "./ids";

/**
 * Tenant and role management concerns:
 * - tenant lifecycle
 * - tenant-level RBAC
 * - member lifecycle in a tenant
 */
export class TenantRoleService extends PlatformCoreService {
  private formatInviteName(email: string): string {
    const localPart = email.split("@")[0] ?? email;
    const normalized = localPart.replace(/[._-]+/g, " ").trim().replace(/\s+/g, " ");
    if (!normalized) {
      return email;
    }
    return normalized
      .split(" ")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  async createTenant(name: string, ownerUser: AuthenticatedUser): Promise<TenantEntity> {
    await this.ensureMasterCatalogs();
    await this.upsertUserProfile(ownerUser);
    const timestamp = nowIso();
    const tenant: TenantEntity = {
      id: newId(),
      name,
      ownerIds: [ownerUser.uid],
      deletedAt: null,
      deletedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.tenants, tenant);
    const seededRoles = await this.bootstrapDefaultRoles(tenant.id, timestamp);
    const ownerRole = seededRoles.find((role) => role.key === SYSTEM_ROLE_KEYS.owner);
    await this.bootstrapPresetDepartmentsAndTasks(tenant.id, ownerUser.uid, timestamp);

    const ownerMembership: TenantMembershipEntity = {
      id: tenantMembershipId(tenant.id, ownerUser.uid),
      tenantId: tenant.id,
      userId: ownerUser.uid,
      roleIds: ownerRole ? [ownerRole.id] : [],
      status: "active",
      homeDepartmentId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.set(COLLECTIONS.tenantMemberships, ownerMembership.id, ownerMembership);

    await this.createAuditLog(tenant.id, ownerUser.uid, "tenant.create", "tenant", tenant.id, {
      name
    });
    return tenant;
  }

  async deleteTenant(tenantId: string, actor: AuthenticatedUser): Promise<TenantEntity> {
    const tenant = await this.store.getById<TenantEntity>(COLLECTIONS.tenants, tenantId);
    if (!tenant || tenant.deletedAt) {
      notFound("Tenant not found");
    }
    if (!tenant.ownerIds.includes(actor.uid)) {
      forbidden("Only tenant owners can delete this tenant");
    }

    const timestamp = nowIso();
    const deletedTenant = await this.store.update<TenantEntity>(COLLECTIONS.tenants, tenant.id, {
      deletedAt: timestamp,
      deletedBy: actor.uid,
      updatedAt: timestamp
    });
    await this.createAuditLog(tenantId, actor.uid, "tenant.delete", "tenant", tenantId, {});
    return deletedTenant;
  }

  async getTenantContext(tenantId: string, userId: string): Promise<TenantContext> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, userId)
    );

    const isOwner = tenant.ownerIds.includes(userId);
    if (!isOwner && (!membership || membership.status !== "active")) {
      forbidden("User is not an active member of this tenant");
    }

    const effectiveMembership: TenantMembershipEntity =
      membership ??
      ({
        id: tenantMembershipId(tenantId, userId),
        tenantId,
        userId,
        roleIds: [],
        status: "active",
        homeDepartmentId: null,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      } satisfies TenantMembershipEntity);

    // Owner gets full permission set by default.
    const permissions = new Set<string>();
    if (isOwner) {
      for (const permission of ALL_PERMISSION_KEYS) {
        permissions.add(permission);
      }
      return { tenantId, membership: effectiveMembership, isOwner, permissions };
    }

    if (effectiveMembership.roleIds.length > 0) {
      const roles = await this.store.query<TenantRoleEntity>(COLLECTIONS.tenantRoles, [
        { field: "tenantId", op: "==", value: tenantId }
      ]);
      const roleMap = new Map(roles.map((role) => [role.id, role]));
      for (const roleId of effectiveMembership.roleIds) {
        const role = roleMap.get(roleId);
        if (!role) {
          continue;
        }
        for (const permission of role.permissionKeys) {
          permissions.add(permission);
        }
      }
    }

    return { tenantId, membership: effectiveMembership, isOwner, permissions };
  }

  async assertPermission(context: TenantContext, permission: string): Promise<void> {
    if (context.isOwner) {
      return;
    }
    if (!context.permissions.has(permission)) {
      forbidden(`Missing permission: ${permission}`);
    }
  }

  async createRole(
    tenantId: string,
    actorUserId: string,
    input: { name: string; permissionKeys: string[] }
  ): Promise<TenantRoleEntity> {
    await this.getTenantOrThrow(tenantId);
    await this.assertPermissionKeysConfigured(input.permissionKeys);
    const timestamp = nowIso();
    const role: TenantRoleEntity = {
      id: newId(),
      tenantId,
      name: input.name,
      isSystem: false,
      permissionKeys: [...new Set(input.permissionKeys)],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.tenantRoles, role);
    await this.createAuditLog(tenantId, actorUserId, "role.create", "role", role.id, {
      name: role.name
    });
    return role;
  }

  async listRoles(tenantId: string): Promise<TenantRoleEntity[]> {
    return this.store.query<TenantRoleEntity>(
      COLLECTIONS.tenantRoles,
      [{ field: "tenantId", op: "==", value: tenantId }],
      { orderBy: "createdAt", direction: "asc" }
    );
  }

  async deleteRole(
    tenantId: string,
    roleId: string,
    actorUserId: string
  ): Promise<TenantRoleEntity> {
    await this.getTenantOrThrow(tenantId);
    const role = await this.store.getById<TenantRoleEntity>(COLLECTIONS.tenantRoles, roleId);
    if (!role || role.tenantId !== tenantId) {
      notFound("Role not found");
    }
    if (role.isSystem) {
      badRequest("System roles cannot be deleted");
    }

    const memberships = await this.store.query<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    const assignedMemberships = memberships.filter((membership) => membership.roleIds.includes(roleId));
    if (assignedMemberships.length > 0) {
      const users = await this.getUsersByIds(assignedMemberships.map((membership) => membership.userId));
      const userMap = new Map(users.map((user) => [user.id, user]));
      const assignedUsers = assignedMemberships
        .map((membership) => {
          const user = userMap.get(membership.userId);
          const name = user?.name ?? membership.userId;
          const email = user?.email ?? "unknown@example.com";
          return `${name} (${email})`;
        })
        .sort((left, right) => left.localeCompare(right));

      badRequest(
        `Cannot delete role "${role.name}" because it is assigned to: ${assignedUsers.join(", ")}`
      );
    }

    await this.store.delete(COLLECTIONS.tenantRoles, role.id);
    await this.createAuditLog(tenantId, actorUserId, "role.delete", "role", role.id, {
      name: role.name
    });
    return role;
  }

  async assignRolesToMember(
    tenantId: string,
    memberUserId: string,
    roleIds: string[],
    actorUserId: string
  ): Promise<TenantMembershipEntity> {
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, memberUserId)
    );
    if (!membership) {
      notFound("Member not found in tenant");
    }
    const roles = await this.listRoles(tenantId);
    const roleSet = new Set(roles.map((role) => role.id));
    for (const roleId of roleIds) {
      if (!roleSet.has(roleId)) {
        badRequest(`Invalid roleId: ${roleId}`);
      }
    }

    const next = await this.store.update<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membership.id,
      { roleIds: [...new Set(roleIds)], updatedAt: nowIso() }
    );
    await this.createAuditLog(tenantId, actorUserId, "membership.assign_roles", "membership", next.id, {
      memberUserId,
      roleIds
    });
    return next;
  }

  async listTenantMembers(tenantId: string): Promise<Array<{
    id: string;
    tenantId: string;
    userId: string;
    email: string;
    name: string;
    status: TenantMembershipEntity["status"];
    roleIds: string[];
    roleNames: string[];
    homeDepartmentId: string | null;
    isOwner: boolean;
    createdAt: string;
    updatedAt: string;
  }>> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const memberships = await this.store.query<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      [{ field: "tenantId", op: "==", value: tenantId }],
      { orderBy: "createdAt", direction: "asc" }
    );
    const roles = await this.listRoles(tenantId);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const users = await this.getUsersByIds(memberships.map((membership) => membership.userId));
    const userMap = new Map(users.map((user) => [user.id, user]));

    return memberships.map((membership) => {
      const user = userMap.get(membership.userId);
      const isOwner = tenant.ownerIds.includes(membership.userId);
      const resolvedRoleNames = membership.roleIds
        .map((roleId) => roleMap.get(roleId)?.name)
        .filter((name): name is string => Boolean(name));
      const roleNames = resolvedRoleNames.length > 0 ? resolvedRoleNames : isOwner ? ["Owner"] : [];

      return {
        id: membership.id,
        tenantId: membership.tenantId,
        userId: membership.userId,
        email: user?.email ?? "unknown@example.com",
        name: user?.name ?? membership.userId,
        status: membership.status,
        roleIds: membership.roleIds,
        roleNames,
        homeDepartmentId: membership.homeDepartmentId,
        isOwner,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt
      };
    });
  }

  async addTenantMember(
    tenantId: string,
    input: {
      userId: string;
      email: string;
      name: string;
      homeDepartmentId: string;
      roleIds?: string[];
      roleId?: string;
    },
    actorUserId: string
  ): Promise<TenantMembershipEntity> {
    const department = await this.getDepartmentOrThrow(tenantId, input.homeDepartmentId);
    const timestamp = nowIso();
    const roleIds = await this.resolveRoleIdsForMembership(
      tenantId,
      input.roleId ? [input.roleId] : (input.roleIds ?? [])
    );

    const user: UserEntity = {
      id: input.userId,
      email: input.email,
      name: input.name,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.set(COLLECTIONS.users, user.id, user);

    const membershipId = tenantMembershipId(tenantId, input.userId);
    const existing = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membershipId
    );
    const membership: TenantMembershipEntity = {
      id: membershipId,
      tenantId,
      userId: input.userId,
      roleIds,
      status: "active",
      homeDepartmentId: department.id,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    await this.store.set(COLLECTIONS.tenantMemberships, membership.id, membership);

    await this.createAuditLog(tenantId, actorUserId, "membership.add", "membership", membership.id, {
      memberUserId: input.userId,
      homeDepartmentId: input.homeDepartmentId
    });
    return membership;
  }

  async removeTenantMember(
    tenantId: string,
    memberUserId: string,
    actorUserId: string
  ): Promise<TenantMembershipEntity> {
    const tenant = await this.getTenantOrThrow(tenantId);
    if (tenant.ownerIds.includes(memberUserId)) {
      badRequest("Tenant owner cannot be removed");
    }
    if (memberUserId === actorUserId) {
      badRequest("You cannot remove yourself from this tenant");
    }

    const membershipId = tenantMembershipId(tenantId, memberUserId);
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membershipId
    );
    if (!membership) {
      notFound("Member not found in tenant");
    }

    const [departmentMemberships, departmentHodAssignments] = await Promise.all([
      this.store.query<{
        id: string;
        departmentId: string;
      }>(COLLECTIONS.departmentMemberships, [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "userId", op: "==", value: memberUserId }
      ]),
      this.store.query<{
        id: string;
        departmentId: string;
      }>(COLLECTIONS.departmentHods, [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "userId", op: "==", value: memberUserId }
      ])
    ]);

    await this.store.delete(COLLECTIONS.tenantMemberships, membershipId);

    await Promise.all([
      ...departmentMemberships.map((record) =>
        this.store.delete(COLLECTIONS.departmentMemberships, record.id)
      ),
      ...departmentHodAssignments.map((record) =>
        this.store.delete(COLLECTIONS.departmentHods, record.id)
      )
    ]);

    await this.createAuditLog(tenantId, actorUserId, "membership.remove", "membership", membershipId, {
      memberUserId,
      removedDepartmentMembershipCount: departmentMemberships.length,
      removedHodAssignmentCount: departmentHodAssignments.length
    });
    return membership;
  }

  async inviteTenantMember(
    tenantId: string,
    input: {
      userId?: string;
      email: string;
      name?: string;
      homeDepartmentId?: string | null;
      roleId?: string;
      roleIds?: string[];
    },
    actorUserId: string
  ): Promise<{ invite: TenantInviteEntity }> {
    await this.getTenantOrThrow(tenantId);
    const department = input.homeDepartmentId
      ? await this.getDepartmentOrThrow(tenantId, input.homeDepartmentId)
      : null;
    const timestamp = nowIso();
    const normalizedEmail = input.email.trim().toLowerCase();
    const pendingInvitesForEmail = await this.store.query<TenantInviteEntity>(COLLECTIONS.tenantInvites, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "email", op: "==", value: normalizedEmail },
      { field: "status", op: "==", value: "pending" }
    ]);
    if (pendingInvitesForEmail.length > 0) {
      badRequest("A pending invite already exists for this email in the selected tenant");
    }

    const roleIds = await this.resolveRoleIdsForMembership(
      tenantId,
      input.roleId ? [input.roleId] : (input.roleIds ?? [])
    );

    const invite: TenantInviteEntity = {
      id: newId(),
      tenantId,
      userId: input.userId?.trim() || null,
      email: normalizedEmail,
      name: input.name?.trim() || this.formatInviteName(normalizedEmail),
      homeDepartmentId: department?.id ?? null,
      roleIds,
      invitedBy: actorUserId,
      status: "pending",
      acceptedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.tenantInvites, invite);

    await this.createAuditLog(tenantId, actorUserId, "invite.create", "invite", invite.id, {
      inviteeEmail: invite.email,
      roleIds
    });
    return { invite };
  }

  async acceptInvite(
    tenantId: string,
    inviteId: string,
    actor: AuthenticatedUser
  ): Promise<TenantMembershipEntity> {
    const invite = await this.store.getById<TenantInviteEntity>(COLLECTIONS.tenantInvites, inviteId);
    if (!invite || invite.tenantId !== tenantId) {
      notFound("Invite not found");
    }
    if (invite.status !== "pending") {
      badRequest("Invite is no longer pending");
    }
    const actorEmail = actor.email.toLowerCase();
    const inviteEmail = invite.email.toLowerCase();
    const emailMatches = inviteEmail === actorEmail;
    const userIdMatches = invite.userId ? invite.userId === actor.uid : false;
    if (!emailMatches && !userIdMatches) {
      forbidden("Invite does not belong to this user");
    }

    await this.upsertUserProfile(actor);

    const membershipId = tenantMembershipId(tenantId, actor.uid);
    const existing = await this.store.getById<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, membershipId);

    const timestamp = nowIso();
    const activatedMembership: TenantMembershipEntity = existing
      ? {
          ...existing,
          status: "active",
          roleIds: [...new Set([...existing.roleIds, ...invite.roleIds])],
          homeDepartmentId: existing.homeDepartmentId ?? invite.homeDepartmentId ?? null,
          updatedAt: timestamp
        }
      : {
          id: membershipId,
          tenantId,
          userId: actor.uid,
          roleIds: invite.roleIds,
          status: "active",
          homeDepartmentId: invite.homeDepartmentId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        };
    await this.store.set(COLLECTIONS.tenantMemberships, membershipId, activatedMembership);

    await this.store.update<TenantInviteEntity>(COLLECTIONS.tenantInvites, invite.id, {
      status: "accepted",
      acceptedAt: timestamp,
      updatedAt: timestamp,
      userId: actor.uid
    });
    await this.createAuditLog(tenantId, actor.uid, "invite.accept", "invite", invite.id, {});
    return activatedMembership;
  }

  async rejectInvite(
    tenantId: string,
    inviteId: string,
    actor: AuthenticatedUser
  ): Promise<TenantInviteEntity> {
    const invite = await this.store.getById<TenantInviteEntity>(COLLECTIONS.tenantInvites, inviteId);
    if (!invite || invite.tenantId !== tenantId) {
      notFound("Invite not found");
    }
    if (invite.status !== "pending") {
      badRequest("Invite is no longer pending");
    }

    const actorEmail = actor.email.toLowerCase();
    const inviteEmail = invite.email.toLowerCase();
    const emailMatches = inviteEmail === actorEmail;
    const userIdMatches = invite.userId ? invite.userId === actor.uid : false;
    if (!emailMatches && !userIdMatches) {
      forbidden("Invite does not belong to this user");
    }

    const rejectedInvite = await this.store.update<TenantInviteEntity>(COLLECTIONS.tenantInvites, invite.id, {
      status: "revoked",
      acceptedAt: null,
      updatedAt: nowIso(),
      userId: actor.uid
    });
    await this.createAuditLog(tenantId, actor.uid, "invite.reject", "invite", invite.id, {});
    return rejectedInvite;
  }

  async listPendingInvitesForUser(
    user: AuthenticatedUser
  ): Promise<Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    email: string;
    name: string;
    roleIds: string[];
    roleNames: string[];
    homeDepartmentId: string | null;
    invitedBy: string;
    invitedByName: string | null;
    status: "pending";
    createdAt: string;
    updatedAt: string;
  }>> {
    const normalizedEmail = user.email.toLowerCase();
    const invites = await this.store.query<TenantInviteEntity>(COLLECTIONS.tenantInvites, [
      { field: "email", op: "==", value: normalizedEmail },
      { field: "status", op: "==", value: "pending" }
    ]);
    if (invites.length === 0) {
      return [];
    }

    const uniqueTenantIds = [...new Set(invites.map((invite) => invite.tenantId))];
    const tenants = await Promise.all(
      uniqueTenantIds.map((id) => this.store.getById<TenantEntity>(COLLECTIONS.tenants, id))
    );
    const activeTenantMap = new Map(
      tenants
        .filter((tenant): tenant is TenantEntity => Boolean(tenant && !tenant.deletedAt))
        .map((tenant) => [tenant.id, tenant])
    );

    const roleMaps = new Map<string, Map<string, string>>();
    await Promise.all(
      [...activeTenantMap.keys()].map(async (id) => {
        const roles = await this.listRoles(id);
        roleMaps.set(
          id,
          new Map(roles.map((role) => [role.id, role.name]))
        );
      })
    );

    const inviterIds = [...new Set(invites.map((invite) => invite.invitedBy))];
    const inviters = await this.getUsersByIds(inviterIds);
    const inviterMap = new Map(inviters.map((inviter) => [inviter.id, inviter]));

    return invites
      .filter((invite) => activeTenantMap.has(invite.tenantId))
      .map((invite) => ({
        id: invite.id,
        tenantId: invite.tenantId,
        tenantName: activeTenantMap.get(invite.tenantId)!.name,
        email: invite.email,
        name: invite.name,
        roleIds: invite.roleIds,
        roleNames:
          invite.roleIds
            .map((roleId) => roleMaps.get(invite.tenantId)?.get(roleId))
            .filter((value): value is string => Boolean(value)) ?? [],
        homeDepartmentId: invite.homeDepartmentId,
        invitedBy: invite.invitedBy,
        invitedByName: inviterMap.get(invite.invitedBy)?.name ?? null,
        status: "pending" as const,
        createdAt: invite.createdAt,
        updatedAt: invite.updatedAt
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listTenantInvites(
    tenantId: string
  ): Promise<Array<{
    id: string;
    tenantId: string;
    userId: string | null;
    email: string;
    name: string;
    homeDepartmentId: string | null;
    roleIds: string[];
    roleNames: string[];
    invitedBy: string;
    invitedByName: string | null;
    status: "pending" | "accepted" | "revoked";
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>> {
    await this.getTenantOrThrow(tenantId);
    const invites = await this.store.query<TenantInviteEntity>(
      COLLECTIONS.tenantInvites,
      [{ field: "tenantId", op: "==", value: tenantId }],
      { orderBy: "createdAt", direction: "desc" }
    );
    const roles = await this.listRoles(tenantId);
    const roleMap = new Map(roles.map((role) => [role.id, role.name]));
    const inviterIds = [...new Set(invites.map((invite) => invite.invitedBy))];
    const inviters = await this.getUsersByIds(inviterIds);
    const inviterMap = new Map(inviters.map((inviter) => [inviter.id, inviter]));

    return invites.map((invite) => ({
      id: invite.id,
      tenantId: invite.tenantId,
      userId: invite.userId,
      email: invite.email,
      name: invite.name,
      homeDepartmentId: invite.homeDepartmentId,
      roleIds: invite.roleIds,
      roleNames: invite.roleIds
        .map((roleId) => roleMap.get(roleId))
        .filter((value): value is string => Boolean(value)),
      invitedBy: invite.invitedBy,
      invitedByName: inviterMap.get(invite.invitedBy)?.name ?? null,
      status: invite.status,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt
    }));
  }

  private async bootstrapDefaultRoles(
    tenantId: string,
    timestamp: string
  ): Promise<TenantRoleEntity[]> {
    const roles: TenantRoleEntity[] = [];
    for (const definition of DEFAULT_TENANT_ROLES) {
      const role: TenantRoleEntity = {
        id: newId(),
        tenantId,
        key: definition.key,
        name: definition.name,
        isSystem: true,
        permissionKeys: definition.permissionKeys,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.tenantRoles, role);
      roles.push(role);
    }
    return roles;
  }

  private async bootstrapPresetDepartmentsAndTasks(
    tenantId: string,
    actorUserId: string,
    timestamp: string
  ): Promise<void> {
    const presetDepartments = await this.listPresetDepartmentCatalog();
    const presetTaskTemplates = await this.listPresetTaskTemplateCatalog();

    const fieldTypes = [
      ...new Set(
        presetTaskTemplates.flatMap((template) => template.fields.map((field) => field.type))
      )
    ];
    await this.assertFieldTypesConfigured(fieldTypes);

    const departmentIdByPresetKey = new Map<string, string>();
    for (const presetDepartment of presetDepartments) {
      const department: DepartmentEntity = {
        id: newId(),
        tenantId,
        name: presetDepartment.name,
        description: presetDepartment.description,
        createdBy: actorUserId,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.departments, department);
      departmentIdByPresetKey.set(presetDepartment.key, department.id);
    }

    for (const presetTaskTemplate of presetTaskTemplates) {
      const taskTemplate: TaskTemplateEntity = {
        id: newId(),
        tenantId,
        key: presetTaskTemplate.key,
        name: presetTaskTemplate.name,
        description: presetTaskTemplate.description,
        version: 1,
        fields: this.clonePresetFields(presetTaskTemplate.fields),
        createdBy: actorUserId,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.store.create(COLLECTIONS.taskTemplates, taskTemplate);

      const departmentIds = this.resolvePresetTemplateDepartmentIds(
        presetTaskTemplate,
        departmentIdByPresetKey
      );
      for (const departmentId of departmentIds) {
        const assignment: DepartmentTaskEntity = {
          id: newId(),
          tenantId,
          departmentId,
          taskTemplateId: taskTemplate.id,
          assignedBy: actorUserId,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await this.store.create(COLLECTIONS.departmentTasks, assignment);
      }
    }
  }

  private resolvePresetTemplateDepartmentIds(
    template: PresetTaskTemplateCatalogEntity,
    departmentIdByPresetKey: Map<string, string>
  ): string[] {
    if (template.assignedDepartmentKeys.includes("*")) {
      return [...departmentIdByPresetKey.values()];
    }
    const ids = template.assignedDepartmentKeys
      .map((departmentKey) => departmentIdByPresetKey.get(departmentKey))
      .filter((departmentId): departmentId is string => Boolean(departmentId));
    return [...new Set(ids)];
  }

  private clonePresetFields(fields: TaskTemplateEntity["fields"]): TaskTemplateEntity["fields"] {
    return fields.map((field) => ({
      ...field,
      options: field.options ? [...field.options] : undefined
    }));
  }

  private async resolveRoleIdsForMembership(
    tenantId: string,
    requestedRoleIds: string[]
  ): Promise<string[]> {
    const roles = await this.listRoles(tenantId);
    const roleMap = new Map(roles.map((role) => [role.id, role]));

    if (requestedRoleIds.length > 0) {
      const uniqueRequested = [...new Set(requestedRoleIds)];
      for (const roleId of uniqueRequested) {
        if (!roleMap.has(roleId)) {
          badRequest(`Invalid roleId: ${roleId}`);
        }
      }
      return uniqueRequested;
    }

    // Default all new members/invites to Staff when caller does not provide a role.
    const staffRole = roles.find((role) => role.key === SYSTEM_ROLE_KEYS.staff);
    if (!staffRole) {
      badRequest("Default staff role not found for tenant");
    }
    return [staffRole.id];
  }
}
