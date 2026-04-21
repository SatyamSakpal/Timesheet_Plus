import { badRequest, forbidden } from "../../errors/app-error";
import {
  COLLECTIONS,
  type DepartmentEntity,
  type DepartmentHodEntity,
  type DepartmentMembershipEntity,
  type TenantMembershipEntity,
  type TenantRoleEntity,
  type UserEntity
} from "../../types/domain";
import { nowIso, newId } from "../../utils/entity";
import { departmentHodId, departmentMembershipId, tenantMembershipId } from "./ids";
import { TenantRoleService } from "./tenant-role.service";

/**
 * Department and people visibility concerns:
 * - department CRUD
 * - member assignments / HOD assignments
 * - member and contributor lists for HOD views
 */
export class DepartmentService extends TenantRoleService {
  async listTenantDepartments(tenantId: string): Promise<DepartmentEntity[]> {
    await this.getTenantOrThrow(tenantId);
    const departments = await this.store.query<DepartmentEntity>(COLLECTIONS.departments, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    return departments.sort((left, right) => left.name.localeCompare(right.name));
  }

  async createDepartment(
    tenantId: string,
    input: { name: string; description?: string },
    actorUserId: string
  ): Promise<DepartmentEntity> {
    await this.getTenantOrThrow(tenantId);
    const timestamp = nowIso();
    const department: DepartmentEntity = {
      id: newId(),
      tenantId,
      name: input.name,
      description: input.description,
      createdBy: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.departments, department);
    await this.createAuditLog(tenantId, actorUserId, "department.create", "department", department.id, {
      name: department.name
    });
    return department;
  }

  async assignDepartmentMember(
    tenantId: string,
    departmentId: string,
    userId: string,
    actorUserId: string
  ): Promise<DepartmentMembershipEntity> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const tenantMembership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, userId)
    );
    if (!tenantMembership || tenantMembership.status !== "active") {
      badRequest("User must be an active tenant member before department assignment");
    }

    const timestamp = nowIso();
    const member: DepartmentMembershipEntity = {
      id: departmentMembershipId(tenantId, departmentId, userId),
      tenantId,
      departmentId,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.set(COLLECTIONS.departmentMemberships, member.id, member);
    await this.createAuditLog(tenantId, actorUserId, "department.member.assign", "department", departmentId, {
      userId
    });
    return member;
  }

  async assignDepartmentHod(
    tenantId: string,
    departmentId: string,
    userId: string,
    actorUserId: string
  ): Promise<DepartmentHodEntity> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, userId)
    );
    if (!membership || membership.status !== "active") {
      badRequest("HOD must be an active tenant member");
    }
    const timestamp = nowIso();
    const hod: DepartmentHodEntity = {
      id: departmentHodId(tenantId, departmentId, userId),
      tenantId,
      departmentId,
      userId,
      assignedBy: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.set(COLLECTIONS.departmentHods, hod.id, hod);
    await this.createAuditLog(tenantId, actorUserId, "department.hod.assign", "department", departmentId, {
      userId
    });
    return hod;
  }

  async isDepartmentHod(tenantId: string, departmentId: string, userId: string): Promise<boolean> {
    const hod = await this.store.getById<DepartmentHodEntity>(
      COLLECTIONS.departmentHods,
      departmentHodId(tenantId, departmentId, userId)
    );
    return Boolean(hod);
  }

  async listDepartmentMembers(tenantId: string, departmentId: string): Promise<UserEntity[]> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const memberships = await this.store.query<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "status", op: "==", value: "active" }
    ]);
    const explicitAssignments = await this.store.query<DepartmentMembershipEntity>(
      COLLECTIONS.departmentMemberships,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId }
      ]
    );
    const explicitUserIds = new Set(explicitAssignments.map((assignment) => assignment.userId));
    const memberUserIds = memberships
      .filter(
        (membership) =>
          membership.homeDepartmentId === departmentId || explicitUserIds.has(membership.userId)
      )
      .map((membership) => membership.userId);
    return this.getUsersByIds(memberUserIds);
  }

  async listDepartmentContributors(
    tenantId: string,
    departmentId: string
  ): Promise<Array<UserEntity & { entryCount: number; latestEntryAt: string | null }>> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const activities = await this.store.query<
      {
        userId: string;
        createdAt: string;
      }
    >(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "workDepartmentId", op: "==", value: departmentId }
    ]);
    const members = await this.listDepartmentMembers(tenantId, departmentId);
    const memberIds = new Set(members.map((member) => member.id));

    const contributorStats = new Map<string, { count: number; latest: string }>();
    for (const activity of activities) {
      const current = contributorStats.get(activity.userId);
      if (!current) {
        contributorStats.set(activity.userId, { count: 1, latest: activity.createdAt });
      } else {
        current.count += 1;
        if (activity.createdAt > current.latest) {
          current.latest = activity.createdAt;
        }
      }
    }
    const externalContributorIds = [...contributorStats.keys()].filter(
      (userId) => !memberIds.has(userId)
    );
    const users = await this.getUsersByIds(externalContributorIds);
    return users.map((user) => ({
      ...user,
      entryCount: contributorStats.get(user.id)?.count ?? 0,
      latestEntryAt: contributorStats.get(user.id)?.latest ?? null
    }));
  }

  async listTenantUsersForOwnerOrHod(
    tenantId: string,
    viewerUserId: string
  ): Promise<{
    scope: "owner" | "hod";
    managedDepartmentIds: string[];
    users: Array<{
      userId: string;
      name: string;
      email: string;
      status: "active" | "invited" | "suspended";
      roleIds: string[];
      roleNames: string[];
      homeDepartmentId: string | null;
      isOwner: boolean;
      departmentIds: string[];
      visibility: "tenant" | "member" | "contributor" | "member+contributor";
    }>;
  }> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const isOwnerViewer = tenant.ownerIds.includes(viewerUserId);

    if (isOwnerViewer) {
      const members = await this.listTenantMembers(tenantId);
      return {
        scope: "owner",
        managedDepartmentIds: [],
        users: members
          .map((member) => ({
            userId: member.userId,
            name: member.name,
            email: member.email,
            status: member.status,
            roleIds: member.roleIds,
            roleNames: member.roleNames,
            homeDepartmentId: member.homeDepartmentId,
            isOwner: member.isOwner,
            departmentIds: member.homeDepartmentId ? [member.homeDepartmentId] : [],
            visibility: "tenant" as const
          }))
          .sort((left, right) => left.name.localeCompare(right.name))
      };
    }

    const hodAssignments = await this.store.query<DepartmentHodEntity>(COLLECTIONS.departmentHods, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "userId", op: "==", value: viewerUserId }
    ]);
    const managedDepartmentIds = [...new Set(hodAssignments.map((assignment) => assignment.departmentId))];
    if (managedDepartmentIds.length === 0) {
      forbidden("Only owner or department head can list tenant users");
    }

    const roles = await this.store.query<TenantRoleEntity>(COLLECTIONS.tenantRoles, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const memberships = await this.store.query<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "status", op: "==", value: "active" }
    ]);
    const membershipMap = new Map(memberships.map((membership) => [membership.userId, membership]));

    const scopedUsers = new Map<
      string,
      {
        user: UserEntity;
        memberIn: Set<string>;
        contributorIn: Set<string>;
      }
    >();

    for (const departmentId of managedDepartmentIds) {
      const members = await this.listDepartmentMembers(tenantId, departmentId);
      for (const member of members) {
        const current = scopedUsers.get(member.id);
        if (current) {
          current.memberIn.add(departmentId);
        } else {
          scopedUsers.set(member.id, {
            user: member,
            memberIn: new Set([departmentId]),
            contributorIn: new Set<string>()
          });
        }
      }

      const contributors = await this.listDepartmentContributors(tenantId, departmentId);
      for (const contributor of contributors) {
        const current = scopedUsers.get(contributor.id);
        if (current) {
          current.contributorIn.add(departmentId);
        } else {
          scopedUsers.set(contributor.id, {
            user: contributor,
            memberIn: new Set<string>(),
            contributorIn: new Set([departmentId])
          });
        }
      }
    }

    const users = [...scopedUsers.values()]
      .map((entry) => {
        const membership = membershipMap.get(entry.user.id);
        const roleNames =
          membership?.roleIds
            .map((roleId) => roleMap.get(roleId)?.name)
            .filter((name): name is string => Boolean(name)) ?? [];
        const departmentIds = [...new Set([...entry.memberIn, ...entry.contributorIn])].sort();
        const visibility: "member" | "contributor" | "member+contributor" =
          entry.memberIn.size > 0 && entry.contributorIn.size > 0
            ? "member+contributor"
            : entry.memberIn.size > 0
              ? "member"
              : "contributor";

        return {
          userId: entry.user.id,
          name: entry.user.name,
          email: entry.user.email,
          status: membership?.status ?? "active",
          roleIds: membership?.roleIds ?? [],
          roleNames,
          homeDepartmentId: membership?.homeDepartmentId ?? null,
          isOwner: tenant.ownerIds.includes(entry.user.id),
          departmentIds,
          visibility
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      scope: "hod",
      managedDepartmentIds,
      users
    };
  }
}
