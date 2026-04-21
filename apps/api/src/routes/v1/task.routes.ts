import { Router } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { attachTenantContext, requirePermission } from "../../middlewares/tenant-context";
import { getPlatformService } from "../../services";
import { param } from "./helpers";
import { createTaskTemplateSchema } from "./schemas/task.schemas";

const router = Router();
const scopedTenantRouter = Router({ mergeParams: true });

scopedTenantRouter.use(authenticate, attachTenantContext);

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

scopedTenantRouter.post(
  "/departments/:departmentId/tasks/:taskTemplateId",
  requirePermission(PERMISSIONS.taskAssign),
  asyncHandler(async (req, res) => {
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

