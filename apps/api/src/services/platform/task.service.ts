import { badRequest } from "../../errors/app-error";
import {
  COLLECTIONS,
  type DepartmentEntity,
  type DepartmentTaskEntity,
  type TaskTemplateEntity
} from "../../types/domain";
import { nowIso, newId } from "../../utils/entity";
import { DepartmentService } from "./department.service";

/**
 * Task template and assignment concerns:
 * - reusable task templates with schema
 * - per-department task assignment mapping
 */
export class TaskService extends DepartmentService {
  async listTaskTemplates(tenantId: string): Promise<TaskTemplateEntity[]> {
    await this.getTenantOrThrow(tenantId);
    const templates = await this.store.query<TaskTemplateEntity>(COLLECTIONS.taskTemplates, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    return templates.sort((left, right) => left.name.localeCompare(right.name));
  }

  async createTaskTemplate(
    tenantId: string,
    actorUserId: string,
    input: { name: string; description?: string; fields: TaskTemplateEntity["fields"] }
  ): Promise<TaskTemplateEntity> {
    await this.getTenantOrThrow(tenantId);
    await this.assertFieldTypesConfigured(input.fields.map((field) => field.type));
    await this.assertUniqueTaskTemplateName(tenantId, input.name);
    const timestamp = nowIso();
    const template: TaskTemplateEntity = {
      id: newId(),
      tenantId,
      name: input.name,
      description: input.description,
      version: 1,
      fields: input.fields,
      createdBy: actorUserId,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.create(COLLECTIONS.taskTemplates, template);
    await this.createAuditLog(tenantId, actorUserId, "task_template.create", "task_template", template.id, {
      name: template.name
    });
    return template;
  }

  async updateTaskTemplate(
    tenantId: string,
    taskTemplateId: string,
    actorUserId: string,
    input: {
      name: string;
      description?: string;
      fields: TaskTemplateEntity["fields"];
      isActive?: boolean;
    }
  ): Promise<TaskTemplateEntity> {
    const template = await this.getTaskTemplateOrThrow(tenantId, taskTemplateId);
    await this.assertFieldTypesConfigured(input.fields.map((field) => field.type));
    await this.assertUniqueTaskTemplateName(tenantId, input.name, template.id);

    const timestamp = nowIso();
    const next = await this.store.update<TaskTemplateEntity>(COLLECTIONS.taskTemplates, template.id, {
      name: input.name,
      description: input.description,
      fields: input.fields,
      isActive: input.isActive ?? template.isActive,
      version: template.version + 1,
      updatedAt: timestamp
    });

    await this.createAuditLog(
      tenantId,
      actorUserId,
      "task_template.update",
      "task_template",
      template.id,
      {
        name: input.name,
        isActive: input.isActive ?? template.isActive
      }
    );

    return next;
  }

  async deleteTaskTemplate(
    tenantId: string,
    taskTemplateId: string,
    actorUserId: string
  ): Promise<TaskTemplateEntity> {
    const template = await this.getTaskTemplateOrThrow(tenantId, taskTemplateId);
    const assignments = await this.store.query<DepartmentTaskEntity>(COLLECTIONS.departmentTasks, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "taskTemplateId", op: "==", value: taskTemplateId }
    ]);
    if (assignments.length > 0) {
      const departments = await this.store.query<DepartmentEntity>(COLLECTIONS.departments, [
        { field: "tenantId", op: "==", value: tenantId }
      ]);
      const departmentNameById = new Map(departments.map((department) => [department.id, department.name]));
      const assignedDepartmentIds = [...new Set(assignments.map((assignment) => assignment.departmentId))];
      const assignedDepartments = assignedDepartmentIds.map((departmentId) => ({
        id: departmentId,
        name: departmentNameById.get(departmentId) ?? departmentId
      }));
      badRequest(
        `Cannot delete activity "${template.name}" because it is assigned to one or more departments.`,
        { assignedDepartments }
      );
    }

    await this.store.delete(COLLECTIONS.taskTemplates, template.id);
    await this.createAuditLog(tenantId, actorUserId, "task_template.delete", "task_template", template.id, {
      name: template.name
    });
    return template;
  }

  async assignTaskToDepartment(
    tenantId: string,
    departmentId: string,
    taskTemplateId: string,
    actorUserId: string
  ): Promise<DepartmentTaskEntity> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    await this.getTaskTemplateOrThrow(tenantId, taskTemplateId);

    const existingAssignments = await this.store.query<DepartmentTaskEntity>(
      COLLECTIONS.departmentTasks,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId },
        { field: "taskTemplateId", op: "==", value: taskTemplateId }
      ],
      { limit: 1 }
    );
    if (existingAssignments.length > 0) {
      return existingAssignments[0];
    }

    const timestamp = nowIso();
    const assignment: DepartmentTaskEntity = {
      id: newId(),
      tenantId,
      departmentId,
      taskTemplateId,
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
      { taskTemplateId }
    );
    return assignment;
  }

  async unassignTaskFromDepartment(
    tenantId: string,
    departmentId: string,
    taskTemplateId: string,
    actorUserId: string
  ): Promise<void> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    await this.getTaskTemplateOrThrow(tenantId, taskTemplateId);

    const existingAssignments = await this.store.query<DepartmentTaskEntity>(
      COLLECTIONS.departmentTasks,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId },
        { field: "taskTemplateId", op: "==", value: taskTemplateId }
      ]
    );

    for (const assignment of existingAssignments) {
      await this.store.delete(COLLECTIONS.departmentTasks, assignment.id);
    }

    await this.createAuditLog(
      tenantId,
      actorUserId,
      "department.task.unassign",
      "department",
      departmentId,
      { taskTemplateId, removedCount: existingAssignments.length }
    );
  }

  async listDepartmentTasks(tenantId: string, departmentId: string): Promise<TaskTemplateEntity[]> {
    await this.getDepartmentOrThrow(tenantId, departmentId);
    const assignments = await this.store.query<DepartmentTaskEntity>(COLLECTIONS.departmentTasks, [
      { field: "tenantId", op: "==", value: tenantId },
      { field: "departmentId", op: "==", value: departmentId }
    ]);
    if (assignments.length === 0) {
      return [];
    }
    const templates = await this.store.query<TaskTemplateEntity>(COLLECTIONS.taskTemplates, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    const templateMap = new Map(templates.map((template) => [template.id, template]));
    return assignments
      .map((assignment) => templateMap.get(assignment.taskTemplateId))
      .filter((template): template is TaskTemplateEntity => Boolean(template));
  }

  async assertTaskAssignedToDepartment(
    tenantId: string,
    departmentId: string,
    taskTemplateId: string
  ): Promise<void> {
    const assignment = await this.store.query<DepartmentTaskEntity>(
      COLLECTIONS.departmentTasks,
      [
        { field: "tenantId", op: "==", value: tenantId },
        { field: "departmentId", op: "==", value: departmentId },
        { field: "taskTemplateId", op: "==", value: taskTemplateId }
      ],
      { limit: 1 }
    );
    if (assignment.length === 0) {
      badRequest("Task template is not assigned to this department");
    }
  }

  private normalizeTaskTemplateName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
  }

  private async assertUniqueTaskTemplateName(
    tenantId: string,
    name: string,
    excludeTemplateId?: string
  ): Promise<void> {
    const normalizedName = this.normalizeTaskTemplateName(name);
    const templates = await this.store.query<TaskTemplateEntity>(COLLECTIONS.taskTemplates, [
      { field: "tenantId", op: "==", value: tenantId }
    ]);
    const duplicate = templates.find((template) => {
      if (excludeTemplateId && template.id === excludeTemplateId) {
        return false;
      }
      return this.normalizeTaskTemplateName(template.name) === normalizedName;
    });
    if (duplicate) {
      badRequest("Activity name already exists in this tenant");
    }
  }
}
