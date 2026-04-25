import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

let createApp: () => import("express").Express;
let resetPlatformServiceForTests: () => void;

const owner = {
  id: "owner-1",
  email: "owner@tenant.com",
  name: "Owner"
};

const hod = {
  id: "hod-1",
  email: "hod@tenant.com",
  name: "HOD"
};

const worker = {
  id: "worker-1",
  email: "worker@tenant.com",
  name: "Worker"
};

const activityWindow = {
  activityDate: "2026-04-10",
  startTime: "09:00",
  endTime: "10:30"
};

function withAuth(
  req: request.Test,
  user: { id: string; email: string; name: string }
): request.Test {
  return req
    .set("x-user-id", user.id)
    .set("x-user-email", user.email)
    .set("x-user-name", user.name);
}

async function setupBase(app: import("express").Express) {
  const tenantRes = await withAuth(
    request(app).post("/v1/tenants").send({ name: "Tenant A" }),
    owner
  );
  const tenantId = tenantRes.body.data.id as string;

  const departmentA = await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/departments`).send({ name: "Department A" }),
    owner
  );
  const departmentB = await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/departments`).send({ name: "Department B" }),
    owner
  );
  const depAId = departmentA.body.data.id as string;
  const depBId = departmentB.body.data.id as string;

  await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/members`).send({
      userId: worker.id,
      email: worker.email,
      name: worker.name,
      homeDepartmentId: depAId
    }),
    owner
  );

  await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/members`).send({
      userId: hod.id,
      email: hod.email,
      name: hod.name,
      homeDepartmentId: depBId
    }),
    owner
  );

  await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/departments/${depBId}/hods`).send({
      userId: hod.id
    }),
    owner
  );

  const templateRes = await withAuth(
    request(app).post(`/v1/tenants/${tenantId}/task-templates`).send({
      name: "Code Review Task",
      fields: [
        { key: "description", label: "Description", type: "text", required: true },
        { key: "hours", label: "Hours", type: "number", required: true, min: 0.5, max: 12 }
      ]
    }),
    owner
  );
  const taskTemplateId = templateRes.body.data.id as string;

  await withAuth(
    request(app).post(
      `/v1/tenants/${tenantId}/departments/${depBId}/tasks/${taskTemplateId}`
    ),
    owner
  );

  return { tenantId, depAId, depBId, taskTemplateId };
}

describe("TimesheetPlus API", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.MOCK_AUTH_ENABLED = "true";
    process.env.DATA_PROVIDER = "memory";
    const services = await import("../src/services");
    const appModule = await import("../src/app");
    createApp = appModule.createApp;
    resetPlatformServiceForTests = services.resetPlatformServiceForTests;
    resetPlatformServiceForTests();
  });

  it("allows user with home department A to submit activity in department B", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const activityRes = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: {
          description: "Reviewed module",
          hours: 2
        },
        status: "submitted"
      }),
      worker
    );

    expect(activityRes.status).toBe(201);
    expect(activityRes.body.data.homeDepartmentId).toBe(base.depAId);
    expect(activityRes.body.data.workDepartmentId).toBe(base.depBId);
    expect(activityRes.body.data.status).toBe("submitted");
  });

  it("rejects activity when task payload violates schema", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const activityRes = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: {
          description: "Invalid entry",
          hours: "three"
        },
        status: "submitted"
      }),
      worker
    );

    expect(activityRes.status).toBe(400);
  });

  it("rejects activity when time range overlaps existing activity for same user/date", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const first = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        activityDate: "2026-04-10",
        startTime: "09:00",
        endTime: "10:30",
        payload: { description: "Morning review", hours: 1.5 },
        status: "submitted"
      }),
      worker
    );
    expect(first.status).toBe(201);

    const overlapping = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        activityDate: "2026-04-10",
        startTime: "10:00",
        endTime: "11:00",
        payload: { description: "Overlapping review", hours: 1 },
        status: "submitted"
      }),
      worker
    );
    expect(overlapping.status).toBe(400);
    expect(String(overlapping.body.error?.message ?? "")).toContain("Time range overlaps");
  });

  it("allows only assigned HOD to approve department activity", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const outsider = {
      id: "outsider-1",
      email: "outsider@tenant.com",
      name: "Outsider"
    };
    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/members`).send({
        userId: outsider.id,
        email: outsider.email,
        name: outsider.name,
        homeDepartmentId: base.depAId
      }),
      owner
    );

    const created = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Work item", hours: 1.5 },
        status: "submitted"
      }),
      worker
    );
    const activityId = created.body.data.id as string;

    const outsiderApprove = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities/${activityId}/approve`).send({}),
      outsider
    );
    expect(outsiderApprove.status).toBe(403);

    const hodApprove = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities/${activityId}/approve`).send({}),
      hod
    );
    expect(hodApprove.status).toBe(200);
    expect(hodApprove.body.data.status).toBe("approved");
  });

  it("restricts HOD activity visibility and review actions to managed departments", async () => {
    const app = createApp();
    const base = await setupBase(app);

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/departments/${base.depAId}/tasks/${base.taskTemplateId}`),
      owner
    );

    const depAActivity = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depAId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Department A work", hours: 2 },
        status: "submitted"
      }),
      worker
    );
    expect(depAActivity.status).toBe(201);
    const depAActivityId = depAActivity.body.data.id as string;

    const hodDepAActivities = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depAId}/activities`),
      hod
    );
    expect(hodDepAActivities.status).toBe(403);

    const ownerDepAActivities = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depAId}/activities`),
      owner
    );
    expect(ownerDepAActivities.status).toBe(200);
    expect((ownerDepAActivities.body.data as Array<{ id: string }>).map((row) => row.id)).toContain(
      depAActivityId
    );

    const hodApproveDepA = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities/${depAActivityId}/approve`).send({}),
      hod
    );
    expect(hodApproveDepA.status).toBe(403);
  });

  it("lists all activities logged by the current user in /activities/my", async () => {
    const app = createApp();
    const base = await setupBase(app);

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/departments/${base.depAId}/tasks/${base.taskTemplateId}`),
      owner
    );

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Department B work", hours: 2 },
        status: "submitted"
      }),
      worker
    );

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depAId,
        taskTemplateId: base.taskTemplateId,
        activityDate: activityWindow.activityDate,
        startTime: "10:30",
        endTime: "11:30",
        payload: { description: "Department A work", hours: 1 },
        status: "submitted"
      }),
      worker
    );

    const mine = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/activities/my`),
      worker
    );

    expect(mine.status).toBe(200);
    const activities = mine.body.data as Array<{ userId: string; workDepartmentId: string }>;
    expect(activities).toHaveLength(2);
    expect(activities.every((entry) => entry.userId === worker.id)).toBe(true);
    expect(activities.map((entry) => entry.workDepartmentId)).toEqual(
      expect.arrayContaining([base.depAId, base.depBId])
    );
  });

  it("shows contributor in department contributors but not in members", async () => {
    const app = createApp();
    const base = await setupBase(app);

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Cross dept task", hours: 4 },
        status: "submitted"
      }),
      worker
    );

    const membersRes = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depBId}/members`),
      hod
    );
    const contributorsRes = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depBId}/contributors`),
      hod
    );

    const memberIds = (membersRes.body.data as Array<{ id: string }>).map((x) => x.id);
    const contributorIds = (contributorsRes.body.data as Array<{ id: string }>).map((x) => x.id);

    expect(memberIds).not.toContain(worker.id);
    expect(contributorIds).toContain(worker.id);
  });

  it("lists departments for current tenant", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const departmentsRes = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments`),
      owner
    );

    expect(departmentsRes.status).toBe(200);
    const departments = departmentsRes.body.data as Array<{ id: string; tenantId: string; name: string }>;
    expect(departments).toHaveLength(2);
    expect(departments.every((department) => department.tenantId === base.tenantId)).toBe(true);
    const departmentIds = departments.map((department) => department.id);
    expect(departmentIds).toEqual(expect.arrayContaining([base.depAId, base.depBId]));
  });

  it("lists tenant members with role names", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const membersRes = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/members`),
      owner
    );

    expect(membersRes.status).toBe(200);
    const members = membersRes.body.data as Array<{
      userId: string;
      roleNames: string[];
      tenantId: string;
    }>;
    expect(members.length).toBeGreaterThanOrEqual(3);
    expect(members.every((member) => member.tenantId === base.tenantId)).toBe(true);
    const ownerMember = members.find((member) => member.userId === owner.id);
    expect(ownerMember).toBeTruthy();
    expect(ownerMember?.roleNames).toContain("Owner");
  });

  it("lists users directory for owner and HOD scopes", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const ownerDirectory = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users`),
      owner
    );
    expect(ownerDirectory.status).toBe(200);
    expect(ownerDirectory.body.data.scope).toBe("owner");
    const ownerUsers = ownerDirectory.body.data.users as Array<{ userId: string }>;
    expect(ownerUsers.map((user) => user.userId)).toEqual(
      expect.arrayContaining([owner.id, hod.id, worker.id])
    );

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Cross department work", hours: 2 },
        status: "submitted"
      }),
      worker
    );

    const hodDirectory = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users`),
      hod
    );
    expect(hodDirectory.status).toBe(200);
    expect(hodDirectory.body.data.scope).toBe("hod");
    const hodUsers = hodDirectory.body.data.users as Array<{
      userId: string;
      visibility: "member" | "contributor" | "member+contributor";
    }>;
    expect(hodUsers.map((user) => user.userId)).toEqual(expect.arrayContaining([hod.id, worker.id]));
    const workerDirectoryRow = hodUsers.find((user) => user.userId === worker.id);
    expect(workerDirectoryRow?.visibility).toBe("contributor");

    const workerDirectory = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users`),
      worker
    );
    expect(workerDirectory.status).toBe(403);
  });

  it("removes tenant member with permission checks and blocks owner removal", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const workerDeleteAttempt = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/members/${hod.id}`),
      worker
    );
    expect(workerDeleteAttempt.status).toBe(403);

    const ownerDeleteAttempt = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/members/${owner.id}`),
      owner
    );
    expect(ownerDeleteAttempt.status).toBe(400);
    expect(String(ownerDeleteAttempt.body.error?.message ?? "")).toContain("owner");

    const removeHod = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/members/${hod.id}`),
      owner
    );
    expect(removeHod.status).toBe(200);
    expect(removeHod.body.data.userId).toBe(hod.id);

    const membersAfter = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/members`),
      owner
    );
    expect(membersAfter.status).toBe(200);
    const memberIdsAfter = (membersAfter.body.data as Array<{ userId: string }>).map((member) => member.userId);
    expect(memberIdsAfter).not.toContain(hod.id);

    const removedHodUsersDirectory = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users`),
      hod
    );
    expect(removedHodUsersDirectory.status).toBe(403);
  });

  it("updates a task template and increments its version", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const templatesRes = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/task-templates`),
      owner
    );
    expect(templatesRes.status).toBe(200);
    const template = (templatesRes.body.data as Array<{ id: string; version: number }>)[0];
    expect(template).toBeTruthy();

    const updateRes = await withAuth(
      request(app).patch(`/v1/tenants/${base.tenantId}/task-templates/${template.id}`).send({
        name: "Updated Task Name",
        description: "Updated description",
        fields: [
          { key: "description", label: "Description", type: "text", required: true },
          { key: "hours", label: "Hours", type: "number", required: true, min: 0.5, max: 12 },
          { key: "notes", label: "Notes", type: "textarea", required: false }
        ]
      }),
      owner
    );

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.id).toBe(template.id);
    expect(updateRes.body.data.name).toBe("Updated Task Name");
    expect(updateRes.body.data.fields).toHaveLength(3);
    expect(updateRes.body.data.version).toBe(template.version + 1);
  });

  it("deletes unassigned custom role and blocks deleting assigned role with user list", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const customRole = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/roles`).send({
        name: "Finance Reviewer",
        permissionKeys: ["report.view"]
      }),
      owner
    );
    expect(customRole.status).toBe(201);
    const roleId = customRole.body.data.id as string;

    const assignedDelete = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/roles/${roleId}`),
      owner
    );
    expect(assignedDelete.status).toBe(200);

    const secondRole = await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/roles`).send({
        name: "QA Reviewer",
        permissionKeys: ["report.view"]
      }),
      owner
    );
    expect(secondRole.status).toBe(201);
    const secondRoleId = secondRole.body.data.id as string;

    const assignWorkerRole = await withAuth(
      request(app)
        .post(`/v1/tenants/${base.tenantId}/members/${worker.id}/roles`)
        .send({ roleIds: [secondRoleId] }),
      owner
    );
    expect(assignWorkerRole.status).toBe(200);

    const blockedDelete = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/roles/${secondRoleId}`),
      owner
    );
    expect(blockedDelete.status).toBe(400);
    const blockedMessage = String(blockedDelete.body.error?.message ?? "");
    expect(blockedMessage).toContain("assigned to");
    expect(blockedMessage).toContain(worker.name);
    expect(blockedMessage).toContain(worker.email);

    const workerDelete = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/roles/${secondRoleId}`),
      worker
    );
    expect(workerDelete.status).toBe(403);
  });

  it("allows owner to remove a task assignment from a department", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const before = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depBId}/tasks`),
      owner
    );
    expect(before.status).toBe(200);
    expect((before.body.data as Array<{ id: string }>).map((task) => task.id)).toContain(base.taskTemplateId);

    const removeRes = await withAuth(
      request(app).delete(`/v1/tenants/${base.tenantId}/departments/${base.depBId}/tasks/${base.taskTemplateId}`),
      owner
    );
    expect(removeRes.status).toBe(204);

    const after = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/departments/${base.depBId}/tasks`),
      owner
    );
    expect(after.status).toBe(200);
    expect((after.body.data as Array<{ id: string }>).map((task) => task.id)).not.toContain(base.taskTemplateId);
  });

  it("returns user detail and allows owner to update home department", async () => {
    const app = createApp();
    const base = await setupBase(app);

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Cross department work", hours: 3 },
        status: "submitted"
      }),
      worker
    );

    const userDetailBefore = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users/${worker.id}`),
      owner
    );
    expect(userDetailBefore.status).toBe(200);
    expect(userDetailBefore.body.data.scope).toBe("owner");
    expect(userDetailBefore.body.data.user.userId).toBe(worker.id);
    expect(userDetailBefore.body.data.user.homeDepartmentId).toBe(base.depAId);
    expect(userDetailBefore.body.data.stats.totalEntries).toBe(1);

    const updatedMembership = await withAuth(
      request(app)
        .patch(`/v1/tenants/${base.tenantId}/users/${worker.id}/home-department`)
        .send({ homeDepartmentId: base.depBId }),
      owner
    );
    expect(updatedMembership.status).toBe(200);
    expect(updatedMembership.body.data.homeDepartmentId).toBe(base.depBId);

    const userDetailAfter = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users/${worker.id}`),
      owner
    );
    expect(userDetailAfter.status).toBe(200);
    expect(userDetailAfter.body.data.user.homeDepartmentId).toBe(base.depBId);
  });

  it("limits HOD user detail access to managed visibility and blocks home department updates", async () => {
    const app = createApp();
    const base = await setupBase(app);

    const workerHidden = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users/${worker.id}`),
      hod
    );
    expect(workerHidden.status).toBe(403);

    await withAuth(
      request(app).post(`/v1/tenants/${base.tenantId}/activities`).send({
        workDepartmentId: base.depBId,
        taskTemplateId: base.taskTemplateId,
        ...activityWindow,
        payload: { description: "Now visible to HOD", hours: 2 },
        status: "submitted"
      }),
      worker
    );

    const workerVisible = await withAuth(
      request(app).get(`/v1/tenants/${base.tenantId}/users/${worker.id}`),
      hod
    );
    expect(workerVisible.status).toBe(200);
    expect(workerVisible.body.data.scope).toBe("hod");
    expect(workerVisible.body.data.user.visibility).toBe("contributor");
    expect(workerVisible.body.data.activities[0].canReview).toBe(true);

    const hodPatch = await withAuth(
      request(app)
        .patch(`/v1/tenants/${base.tenantId}/users/${worker.id}/home-department`)
        .send({ homeDepartmentId: base.depBId }),
      hod
    );
    expect(hodPatch.status).toBe(403);
  });

  it("seeds default roles and assigns invited role", async () => {
    const app = createApp();
    const invitedUser = {
      id: "invitee-1",
      email: "invitee@tenant.com",
      name: "Invitee"
    };

    const tenantRes = await withAuth(
      request(app).post("/v1/tenants").send({ name: "Tenant Roles" }),
      owner
    );
    const tenantId = tenantRes.body.data.id as string;

    const rolesRes = await withAuth(
      request(app).get(`/v1/tenants/${tenantId}/roles`),
      owner
    );
    expect(rolesRes.status).toBe(200);
    const roles = rolesRes.body.data as Array<{ id: string; name: string; key?: string }>;
    expect(roles.map((role) => role.name)).toEqual(
      expect.arrayContaining(["Owner", "Head of Department", "Staff"])
    );
    const hodRole = roles.find((role) => role.name === "Head of Department");
    expect(hodRole).toBeTruthy();

    const department = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/departments`).send({ name: "Department A" }),
      owner
    );
    const depAId = department.body.data.id as string;

    const inviteRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites`).send({
        userId: invitedUser.id,
        email: invitedUser.email,
        name: invitedUser.name,
        homeDepartmentId: depAId,
        roleId: hodRole!.id
      }),
      owner
    );

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.invite.status).toBe("pending");
    expect(inviteRes.body.data.invite.roleIds).toEqual([hodRole!.id]);
    const inviteId = inviteRes.body.data.invite.id as string;

    const invitesBeforeAccept = await withAuth(
      request(app).get(`/v1/tenants/${tenantId}/invites`),
      owner
    );
    expect(invitesBeforeAccept.status).toBe(200);
    expect(invitesBeforeAccept.body.data[0].status).toBe("pending");

    const acceptRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites/${inviteId}/accept`).send({}),
      invitedUser
    );
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe("active");
    expect(acceptRes.body.data.roleIds).toEqual([hodRole!.id]);

    const invitesAfterAccept = await withAuth(
      request(app).get(`/v1/tenants/${tenantId}/invites`),
      owner
    );
    expect(invitesAfterAccept.status).toBe(200);
    expect(invitesAfterAccept.body.data[0].status).toBe("accepted");
    expect(invitesAfterAccept.body.data[0].acceptedAt).toBeTruthy();
  });

  it("allows inviting a user without a home department", async () => {
    const app = createApp();
    const invitedUser = {
      id: "invitee-nodept-1",
      email: "invitee-nodept@tenant.com",
      name: "Invitee No Department"
    };

    const tenantRes = await withAuth(
      request(app).post("/v1/tenants").send({ name: "Tenant No Department Invite" }),
      owner
    );
    const tenantId = tenantRes.body.data.id as string;

    const inviteRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites`).send({
        userId: invitedUser.id,
        email: invitedUser.email,
        name: invitedUser.name
      }),
      owner
    );

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.invite.status).toBe("pending");
    expect(inviteRes.body.data.invite.homeDepartmentId).toBeNull();

    const inviteId = inviteRes.body.data.invite.id as string;
    const acceptRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites/${inviteId}/accept`).send({}),
      invitedUser
    );
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe("active");
    expect(acceptRes.body.data.homeDepartmentId).toBeNull();
  });

  it("shows pending email invites in /me and creates membership only on accept", async () => {
    const app = createApp();
    const invitee = {
      id: "invitee-by-email-uid",
      email: "invitee-by-email@tenant.com",
      name: "Invitee By Email"
    };

    const tenantRes = await withAuth(
      request(app).post("/v1/tenants").send({ name: "Tenant Invite Visibility" }),
      owner
    );
    const tenantId = tenantRes.body.data.id as string;

    const inviteRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites`).send({
        email: invitee.email
      }),
      owner
    );
    expect(inviteRes.status).toBe(201);
    const inviteId = inviteRes.body.data.invite.id as string;

    const meBeforeAccept = await withAuth(request(app).get("/v1/me"), invitee);
    expect(meBeforeAccept.status).toBe(200);
    expect(meBeforeAccept.body.data.memberships).toHaveLength(0);
    expect(meBeforeAccept.body.data.pendingInvites).toHaveLength(1);
    expect(meBeforeAccept.body.data.pendingInvites[0].tenantId).toBe(tenantId);
    expect(meBeforeAccept.body.data.pendingInvites[0].status).toBe("pending");

    const acceptRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites/${inviteId}/accept`).send({}),
      invitee
    );
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.userId).toBe(invitee.id);
    expect(acceptRes.body.data.status).toBe("active");

    const meAfterAccept = await withAuth(request(app).get("/v1/me"), invitee);
    expect(meAfterAccept.status).toBe(200);
    expect(meAfterAccept.body.data.memberships).toHaveLength(1);
    expect(meAfterAccept.body.data.memberships[0].tenantId).toBe(tenantId);
    expect(meAfterAccept.body.data.pendingInvites).toHaveLength(0);
  });

  it("allows invitee to reject pending invite from tenant dashboard flow", async () => {
    const app = createApp();
    const invitee = {
      id: "invitee-reject-uid",
      email: "invitee-reject@tenant.com",
      name: "Invitee Reject"
    };

    const tenantRes = await withAuth(
      request(app).post("/v1/tenants").send({ name: "Tenant Reject Invite" }),
      owner
    );
    const tenantId = tenantRes.body.data.id as string;

    const inviteRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites`).send({
        email: invitee.email
      }),
      owner
    );
    expect(inviteRes.status).toBe(201);
    const inviteId = inviteRes.body.data.invite.id as string;

    const meBeforeReject = await withAuth(request(app).get("/v1/me"), invitee);
    expect(meBeforeReject.status).toBe(200);
    expect(meBeforeReject.body.data.pendingInvites).toHaveLength(1);

    const rejectRes = await withAuth(
      request(app).post(`/v1/tenants/${tenantId}/invites/${inviteId}/reject`).send({}),
      invitee
    );
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe("revoked");

    const meAfterReject = await withAuth(request(app).get("/v1/me"), invitee);
    expect(meAfterReject.status).toBe(200);
    expect(meAfterReject.body.data.pendingInvites).toHaveLength(0);
    expect(meAfterReject.body.data.memberships).toHaveLength(0);

    const ownerInvites = await withAuth(
      request(app).get(`/v1/tenants/${tenantId}/invites`),
      owner
    );
    expect(ownerInvites.status).toBe(200);
    const updatedInvite = (ownerInvites.body.data as Array<{ id: string; status: string }>).find(
      (entry) => entry.id === inviteId
    );
    expect(updatedInvite?.status).toBe("revoked");
  });

  it("preserves an existing profile name even when a future auth login sends a different provider name", async () => {
    const app = createApp();
    const original = {
      id: "provider-user-1",
      email: "provider-user@tenant.com",
      name: "Chosen Name"
    };
    const googleProfile = {
      ...original,
      name: "Google Display Name"
    };

    const firstMe = await withAuth(request(app).get("/v1/me"), original);
    expect(firstMe.status).toBe(200);
    expect(firstMe.body.data.user.name).toBe("Chosen Name");

    const secondMe = await withAuth(request(app).get("/v1/me"), googleProfile);
    expect(secondMe.status).toBe(200);
    expect(secondMe.body.data.user.name).toBe("Chosen Name");
  });

  it("exposes permission and field master catalogs", async () => {
    const app = createApp();

    const permissionsRes = await withAuth(
      request(app).get("/v1/catalog/permissions"),
      owner
    );
    expect(permissionsRes.status).toBe(200);
    const permissionKeys = (permissionsRes.body.data as Array<{ key: string }>).map((x) => x.key);
    expect(permissionKeys).toContain("activity.create");
    expect(permissionKeys).toContain("role.manage");

    const fieldsRes = await withAuth(
      request(app).get("/v1/catalog/fields"),
      owner
    );
    expect(fieldsRes.status).toBe(200);
    const fieldKeys = (fieldsRes.body.data as Array<{ key: string }>).map((x) => x.key);
    expect(fieldKeys).toEqual(
      expect.arrayContaining(["text", "number", "date", "select", "radio", "checkbox", "textarea"])
    );
  });

  it("soft deletes tenant and excludes it from /me memberships", async () => {
    const app = createApp();

    const tenantRes = await withAuth(
      request(app).post("/v1/tenants").send({ name: "Tenant To Delete" }),
      owner
    );
    expect(tenantRes.status).toBe(201);
    const tenantId = tenantRes.body.data.id as string;

    const deleted = await withAuth(
      request(app).delete(`/v1/tenants/${tenantId}`),
      owner
    );
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deletedAt).toBeTruthy();
    expect(deleted.body.data.deletedBy).toBe(owner.id);

    const meRes = await withAuth(request(app).get("/v1/me"), owner);
    expect(meRes.status).toBe(200);
    const membershipTenantIds = (meRes.body.data.memberships as Array<{ tenantId: string }>).map(
      (membership) => membership.tenantId
    );
    expect(membershipTenantIds).not.toContain(tenantId);

    const rolesRes = await withAuth(
      request(app).get(`/v1/tenants/${tenantId}/roles`),
      owner
    );
    expect(rolesRes.status).toBe(404);
  });
});
