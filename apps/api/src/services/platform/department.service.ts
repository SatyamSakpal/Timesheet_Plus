import { PERMISSIONS } from "../../constants/permissions";
import { badRequest, forbidden, notFound } from "../../errors/app-error";
import {
  COLLECTIONS,
  type ActivityEntryEntity,
  type DepartmentEntity,
  type DepartmentHodEntity,
  type DepartmentMembershipEntity,
  type DepartmentTaskEntity,
  type TaskTemplateEntity,
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
    await this.assignDefaultOtherTaskToDepartment(tenantId, department.id, actorUserId, timestamp);
    await this.createAuditLog(tenantId, actorUserId, "department.create", "department", department.id, {
      name: department.name
    });
    return department;
  }

  async deleteDepartment(
    tenantId: string,
    departmentId: string,
    actorUserId: string
  ): Promise<DepartmentEntity> {
    const department = await this.getDepartmentOrThrow(tenantId, departmentId);

    const [homeDepartmentMemberships, explicitMemberships, hodAssignments] = await Promise.all([
      this.store.query<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "homeDepartmentId", op: "==", value: departmentId }
      ]),
      this.store.query<DepartmentMembershipEntity>(COLLECTIONS.departmentMemberships, [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId }
      ]),
      this.store.query<DepartmentHodEntity>(COLLECTIONS.departmentHods, [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId }
      ])
    ]);

    const userReasonMap = new Map<string, Set<string>>();
    for (const membership of homeDepartmentMemberships) {
      if (!userReasonMap.has(membership.userId)) {
        userReasonMap.set(membership.userId, new Set<string>());
      }
      userReasonMap.get(membership.userId)!.add("Home Department");
    }
    for (const membership of explicitMemberships) {
      if (!userReasonMap.has(membership.userId)) {
        userReasonMap.set(membership.userId, new Set<string>());
      }
      userReasonMap.get(membership.userId)!.add("Department Member");
    }
    for (const hodAssignment of hodAssignments) {
      if (!userReasonMap.has(hodAssignment.userId)) {
        userReasonMap.set(hodAssignment.userId, new Set<string>());
      }
      userReasonMap.get(hodAssignment.userId)!.add("HOD");
    }

    if (userReasonMap.size > 0) {
      const users = await this.getUsersByIds([...userReasonMap.keys()]);
      const userById = new Map(users.map((user) => [user.id, user]));
      const assignedUsers = [...userReasonMap.entries()]
        .map(([userId, reasons]) => ({
          userId,
          name: userById.get(userId)?.name ?? userId,
          email: userById.get(userId)?.email ?? "unknown@example.com",
          reasons: [...reasons].sort()
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      badRequest(
        `Cannot delete department "${department.name}" because users are still assigned to it.`,
        { assignedUsers }
      );
    }

    const departmentTasks = await this.store.query<DepartmentTaskEntity>(COLLECTIONS.departmentTasks, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "departmentId", op: "==", value: departmentId }
    ]);
    for (const assignment of departmentTasks) {
      await this.store.delete(COLLECTIONS.departmentTasks, assignment.id);
    }

    await this.store.delete(COLLECTIONS.departments, department.id);
    await this.createAuditLog(tenantId, actorUserId, "department.delete", "department", department.id, {
      name: department.name,
      removedTaskAssignmentCount: departmentTasks.length
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

  async listDepartmentHods(
    tenantId: string,
    departmentId: string
  ): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      assignedBy: string;
      assignedByName: string | null;
      assignedAt: string;
    }>
  > {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const assignments = await this.store.query<DepartmentHodEntity>(COLLECTIONS.departmentHods, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "departmentId", op: "==", value: departmentId }
    ]);
    if (assignments.length === 0) {
      return [];
    }

    const people = await this.getUsersByIds(
      assignments.flatMap((assignment) => [assignment.userId, assignment.assignedBy])
    );
    const peopleById = new Map(people.map((person) => [person.id, person]));

    return assignments
      .map((assignment) => {
        const hod = peopleById.get(assignment.userId);
        if (!hod) {
          return null;
        }
        return {
          id: hod.id,
          email: hod.email,
          name: hod.name,
          assignedBy: assignment.assignedBy,
          assignedByName: peopleById.get(assignment.assignedBy)?.name ?? null,
          assignedAt: assignment.createdAt
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt));
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

  async getTenantUserDetailForOwnerOrHod(
    tenantId: string,
    viewerUserId: string,
    targetUserId: string
  ): Promise<{
    scope: "owner" | "hod";
    managedDepartmentIds: string[];
    viewerCanManageMember: boolean;
    user: {
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
    };
    stats: {
      totalEntries: number;
      draftCount: number;
      submittedCount: number;
      approvedCount: number;
      rejectedCount: number;
      resubmittedCount: number;
      pendingReviewCount: number;
      uniqueDepartments: number;
      latestActivityAt: string | null;
    };
    activities: Array<
      ActivityEntryEntity & {
        canReview: boolean;
      }
    >;
    availableHomeDepartments: Array<{ id: string; name: string }>;
    departmentNameById: Record<string, string>;
  }> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const viewerContext = await this.getTenantContext(tenantId, viewerUserId);
    const isOwnerViewer = tenant.ownerIds.includes(viewerUserId);

    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      tenantMembershipId(tenantId, targetUserId)
    );
    if (!membership) {
      notFound("User not found in tenant");
    }

    const user = await this.store.getById<UserEntity>(COLLECTIONS.users, targetUserId);
    if (!user) {
      notFound("User profile not found");
    }

    const managedDepartmentIds = isOwnerViewer
      ? []
      : await this.getManagedDepartmentIdsOrThrow(tenantId, viewerUserId);
    const managedSet = new Set(managedDepartmentIds);

    const roles = await this.store.query<TenantRoleEntity>(COLLECTIONS.tenantRoles, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const resolvedRoleNames = membership.roleIds
      .map((roleId) => roleMap.get(roleId)?.name)
      .filter((name): name is string => Boolean(name));
    const isUserOwner = tenant.ownerIds.includes(targetUserId);
    const roleNames = resolvedRoleNames.length > 0 ? resolvedRoleNames : isUserOwner ? ["Owner"] : [];

    const explicitAssignments = await this.store.query<DepartmentMembershipEntity>(
      COLLECTIONS.departmentMemberships,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "userId", op: "==", value: targetUserId }
      ]
    );

    const memberDepartmentIds = new Set<string>();
    if (membership.homeDepartmentId) {
      memberDepartmentIds.add(membership.homeDepartmentId);
    }
    for (const assignment of explicitAssignments) {
      memberDepartmentIds.add(assignment.departmentId);
    }

    const allActivities = await this.store.query<ActivityEntryEntity>(COLLECTIONS.activityEntries, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "userId", op: "==", value: targetUserId }
    ]);

    const visibleActivities = isOwnerViewer
      ? allActivities
      : allActivities.filter((activity) => managedSet.has(activity.workDepartmentId));

    const memberInManaged = [...memberDepartmentIds].filter((departmentId) => managedSet.has(departmentId));
    const contributorInManaged = [
      ...new Set(
        visibleActivities
          .map((activity) => activity.workDepartmentId)
          .filter((departmentId) => !memberDepartmentIds.has(departmentId))
      )
    ];

    if (!isOwnerViewer && memberInManaged.length === 0 && contributorInManaged.length === 0) {
      forbidden("Only users visible in your managed departments can be accessed");
    }

    const visibility: "tenant" | "member" | "contributor" | "member+contributor" = isOwnerViewer
      ? "tenant"
      : memberInManaged.length > 0 && contributorInManaged.length > 0
        ? "member+contributor"
        : memberInManaged.length > 0
          ? "member"
          : "contributor";

    const viewerCanManageMember =
      viewerContext.isOwner || viewerContext.permissions.has(PERMISSIONS.memberManage);
    const viewerCanApproveAny =
      viewerContext.isOwner || viewerContext.permissions.has(PERMISSIONS.activityApprove);

    const activities = visibleActivities
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((activity) => ({
        ...activity,
        canReview: viewerCanApproveAny || managedSet.has(activity.workDepartmentId)
      }));

    const departments = await this.listTenantDepartments(tenantId);
    const departmentNameById = Object.fromEntries(
      departments.map((department) => [department.id, department.name])
    );

    return {
      scope: isOwnerViewer ? "owner" : "hod",
      managedDepartmentIds,
      viewerCanManageMember,
      user: {
        userId: user.id,
        name: user.name,
        email: user.email,
        status: membership.status,
        roleIds: membership.roleIds,
        roleNames,
        homeDepartmentId: membership.homeDepartmentId,
        isOwner: isUserOwner,
        departmentIds: isOwnerViewer
          ? [...memberDepartmentIds].sort()
          : [...new Set([...memberInManaged, ...contributorInManaged])].sort(),
        visibility
      },
      stats: this.buildActivityStats(activities),
      activities,
      availableHomeDepartments: viewerCanManageMember
        ? departments.map((department) => ({ id: department.id, name: department.name }))
        : [],
      departmentNameById
    };
  }

  async updateTenantMemberHomeDepartment(
    tenantId: string,
    memberUserId: string,
    actorUserId: string,
    homeDepartmentId: string | null
  ): Promise<TenantMembershipEntity> {
    const membershipId = tenantMembershipId(tenantId, memberUserId);
    const membership = await this.store.getById<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membershipId
    );
    if (!membership) {
      notFound("Member not found in tenant");
    }

    const department = homeDepartmentId
      ? await this.getDepartmentOrThrow(tenantId, homeDepartmentId)
      : null;

    const timestamp = nowIso();
    const next = await this.store.update<TenantMembershipEntity>(
      COLLECTIONS.tenantMemberships,
      membershipId,
      {
        homeDepartmentId: department?.id ?? null,
        updatedAt: timestamp
      }
    );

    await this.createAuditLog(
      tenantId,
      actorUserId,
      "membership.home_department.update",
      "membership",
      membershipId,
      {
        memberUserId,
        homeDepartmentId: department?.id ?? null
      }
    );

    return next;
  }

  async listManagedDepartmentIds(tenantId: string, userId: string): Promise<string[]> {
    const hodAssignments = await this.store.query<DepartmentHodEntity>(COLLECTIONS.departmentHods, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "userId", op: "==", value: userId }
    ]);
    return [...new Set(hodAssignments.map((assignment) => assignment.departmentId))];
  }

  private async getManagedDepartmentIdsOrThrow(
    tenantId: string,
    userId: string
  ): Promise<string[]> {
    const managedDepartmentIds = await this.listManagedDepartmentIds(tenantId, userId);
    if (managedDepartmentIds.length === 0) {
      forbidden("Only owner or department head can access this user view");
    }
    return managedDepartmentIds;
  }

  private buildActivityStats(
    activities: Array<ActivityEntryEntity | (ActivityEntryEntity & { canReview: boolean })>
  ): {
    totalEntries: number;
    draftCount: number;
    submittedCount: number;
    approvedCount: number;
    rejectedCount: number;
    resubmittedCount: number;
    pendingReviewCount: number;
    uniqueDepartments: number;
    latestActivityAt: string | null;
  } {
    const counters = {
      draftCount: 0,
      submittedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      resubmittedCount: 0
    };
    const departmentIds = new Set<string>();

    for (const activity of activities) {
      departmentIds.add(activity.workDepartmentId);
      if (activity.status === "draft") {
        counters.draftCount += 1;
      } else if (activity.status === "submitted") {
        counters.submittedCount += 1;
      } else if (activity.status === "approved") {
        counters.approvedCount += 1;
      } else if (activity.status === "rejected") {
        counters.rejectedCount += 1;
      } else if (activity.status === "resubmitted") {
        counters.resubmittedCount += 1;
      }
    }

    return {
      totalEntries: activities.length,
      draftCount: counters.draftCount,
      submittedCount: counters.submittedCount,
      approvedCount: counters.approvedCount,
      rejectedCount: counters.rejectedCount,
      resubmittedCount: counters.resubmittedCount,
      pendingReviewCount: counters.submittedCount + counters.resubmittedCount,
      uniqueDepartments: departmentIds.size,
      latestActivityAt: activities[0]?.createdAt ?? null
    };
  }

  private async assignDefaultOtherTaskToDepartment(
    tenantId: string,
    departmentId: string,
    actorUserId: string,
    timestamp: string
  ): Promise<void> {
    const otherTemplate = await this.store.query<TaskTemplateEntity>(COLLECTIONS.taskTemplates, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "key", op: "==", value: "other_activity" },
      { field: "isActive", op: "==", value: true }
    ], { limit: 1 });

    if (otherTemplate.length === 0) {
      return;
    }

    const existingAssignment = await this.store.query<DepartmentTaskEntity>(
      COLLECTIONS.departmentTasks,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId },
        { field: "taskTemplateId", op: "==", value: otherTemplate[0].id }
      ],
      { limit: 1 }
    );
    if (existingAssignment.length > 0) {
      return;
    }

    const assignment: DepartmentTaskEntity = {
      id: newId(),
      tenantId,
      departmentId,
      taskTemplateId: otherTemplate[0].id,
      assignedBy: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.departmentTasks, assignment);
    await this.createAuditLog(
      tenantId,
      actorUserId,
      "department.task.assign",
      "department",
      departmentId,
      { taskTemplateId: otherTemplate[0].id, source: "default_other" }
    );
  }
}
