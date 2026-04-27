import { Router, type Request } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import { forbidden } from "../../errors/app-error";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { attachTenantContext, requirePermission } from "../../middlewares/tenant-context";
import { getPlatformService } from "../../services";
import { param } from "./helpers";
import { createTaskTemplateSchema, updateTaskTemplateSchema } from "./schemas/task.schemas";

const router = Router();
const scopedTenantRouter = Router({ mergeParams: true });

scopedTenantRouter.use(authenticate, attachTenantContext);

function assertCanAssignTasks(req: Request) {
  const canAssignTask =
    req.tenantContext!.isOwner ||
    req.tenantContext!.permissions.has(PERMISSIONS.taskAssign) ||
    req.tenantContext!.permissions.has(PERMISSIONS.taskTemplateManage);
  if (!canAssignTask) {
    forbidden("Only owner or authorized users can assign tasks to departments");
  }
}

scopedTenantRouter.post(
  "/task-templates",
  requirePermission(PERMISSIONS.taskTemplateManage),
  asyncHandler(async (req, res) => {
    const input = createTaskTemplateSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const template = await service.createTaskTemplate(tenantId, req.user!.uid, input);
    res.status(201).json({ data: template });
  })
);

scopedTenantRouter.get(
  "/task-templates",
  asyncHandler(async (req, res) => {
    const canViewTemplates =
      req.tenantContext!.isOwner ||
      req.tenantContext!.permissions.has(PERMISSIONS.taskTemplateManage) ||
      req.tenantContext!.permissions.has(PERMISSIONS.taskAssign) ||
      req.tenantContext!.permissions.has(PERMISSIONS.reportView);
    if (!canViewTemplates) {
      forbidden("Only owner or authorized users can access task templates");
    }

    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const templates = await service.listTaskTemplates(tenantId);
    res.json({ data: templates });
  })
);

scopedTenantRouter.patch(
  "/task-templates/:taskTemplateId",
  requirePermission(PERMISSIONS.taskTemplateManage),
  asyncHandler(async (req, res) => {
    const input = updateTaskTemplateSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const taskTemplateId = param(req, "taskTemplateId");
    const template = await service.updateTaskTemplate(tenantId, taskTemplateId, req.user!.uid, input);
    res.json({ data: template });
  })
);

scopedTenantRouter.delete(
  "/task-templates/:taskTemplateId",
  requirePermission(PERMISSIONS.taskTemplateManage),
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const taskTemplateId = param(req, "taskTemplateId");
    const deletedTemplate = await service.deleteTaskTemplate(tenantId, taskTemplateId, req.user!.uid);
    res.json({ data: deletedTemplate });
  })
);

scopedTenantRouter.post(
  "/departments/:departmentId/tasks/:taskTemplateId",
  asyncHandler(async (req, res) => {
    assertCanAssignTasks(req);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const taskTemplateId = param(req, "taskTemplateId");
    const assignment = await service.assignTaskToDepartment(
      tenantId,
      departmentId,
      taskTemplateId,
      req.user!.uid
    );
    res.status(201).json({ data: assignment });
  })
);

scopedTenantRouter.delete(
  "/departments/:departmentId/tasks/:taskTemplateId",
  asyncHandler(async (req, res) => {
    assertCanAssignTasks(req);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const taskTemplateId = param(req, "taskTemplateId");
    await service.unassignTaskFromDepartment(tenantId, departmentId, taskTemplateId, req.user!.uid);
    res.status(204).send();
  })
);

scopedTenantRouter.get(
  "/departments/:departmentId/tasks",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const tasks = await service.listDepartmentTasks(tenantId, departmentId);
    res.json({ data: tasks });
  })
);

router.use("/tenants/:tenantId", scopedTenantRouter);

export const taskRouter = router;
