import { badRequest } from "../../errors/app-error";
import {
  COLLECTIONS,
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
  async createTaskTemplate(
    tenantId: string,
    actorUserId: string,
    input: { name: string; description?: string; fields: TaskTemplateEntity["fields"] }
  ): Promise<TaskTemplateEntity> {
    await this.getTenantOrThrow(tenantId);
    await this.assertFieldTypesConfigured(input.fields.map((field) => field.type));
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
}
