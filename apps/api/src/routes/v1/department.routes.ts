import { Router, type Request } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import { forbidden } from "../../errors/app-error";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { attachTenantContext, requirePermission } from "../../middlewares/tenant-context";
import { getPlatformService } from "../../services";
import { param } from "./helpers";
import {
  assignDepartmentMemberSchema,
  assignHodSchema,
  createDepartmentSchema
} from "./schemas/department.schemas";

const router = Router();

async function assertDepartmentViewer(req: Request): Promise<void> {
  const service = getPlatformService();
  const tenantId = param(req, "tenantId");
  const departmentId = param(req, "departmentId");
  const managedDepartmentIds = req.tenantContext!.isOwner
    ? []
    : await service.listManagedDepartmentIds(tenantId, req.user!.uid);
  const isManagedByHod = managedDepartmentIds.includes(departmentId);
  if (!req.tenantContext!.isOwner && managedDepartmentIds.length > 0 && !isManagedByHod) {
    forbidden("HOD can only access department views in managed departments");
  }
  const canView =
    req.tenantContext!.isOwner ||
    isManagedByHod ||
    (managedDepartmentIds.length === 0 &&
      req.tenantContext!.permissions.has(PERMISSIONS.reportView));
  if (!canView) {
    forbidden("Only owner/HOD/report viewers can access this department view");
  }
}

const scopedDepartmentRouter = Router({ mergeParams: true });
scopedDepartmentRouter.use(authenticate, attachTenantContext);

scopedDepartmentRouter.post(
  "/",
  requirePermission(PERMISSIONS.departmentManage),
  asyncHandler(async (req, res) => {
    const input = createDepartmentSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const department = await service.createDepartment(tenantId, input, req.user!.uid);
    res.status(201).json({ data: department });
  })
);

scopedDepartmentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const canViewDepartments =
      req.tenantContext!.isOwner ||
      req.tenantContext!.permissions.has(PERMISSIONS.departmentManage) ||
      req.tenantContext!.permissions.has(PERMISSIONS.memberManage) ||
      req.tenantContext!.permissions.has(PERMISSIONS.reportView) ||
      req.tenantContext!.permissions.has(PERMISSIONS.activityCreate);
    if (!canViewDepartments) {
      forbidden("Only owner or authorized department viewers can access departments");
    }

    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departments = await service.listTenantDepartments(tenantId);
    res.json({ data: departments });
  })
);

scopedDepartmentRouter.post(
  "/:departmentId/members",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const input = assignDepartmentMemberSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const member = await service.assignDepartmentMember(
      tenantId,
      departmentId,
      input.userId,
      req.user!.uid
    );
    res.status(201).json({ data: member });
  })
);

scopedDepartmentRouter.post(
  "/:departmentId/hods",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const input = assignHodSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const hod = await service.assignDepartmentHod(tenantId, departmentId, input.userId, req.user!.uid);
    res.status(201).json({ data: hod });
  })
);

scopedDepartmentRouter.get(
  "/:departmentId/members",
  asyncHandler(async (req, res) => {
    await assertDepartmentViewer(req);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const members = await service.listDepartmentMembers(tenantId, departmentId);
    // HOD visibility is intentionally compact to avoid exposing extra profile data.
    const compact = members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name
    }));
    res.json({ data: compact });
  })
);

scopedDepartmentRouter.get(
  "/:departmentId/hods",
  asyncHandler(async (req, res) => {
    await assertDepartmentViewer(req);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const hods = await service.listDepartmentHods(tenantId, departmentId);
    res.json({ data: hods });
  })
);

scopedDepartmentRouter.get(
  "/:departmentId/contributors",
  asyncHandler(async (req, res) => {
    await assertDepartmentViewer(req);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const contributors = await service.listDepartmentContributors(tenantId, departmentId);
    const compact = contributors.map((contributor) => ({
      id: contributor.id,
      email: contributor.email,
      name: contributor.name,
      entryCount: contributor.entryCount,
      latestEntryAt: contributor.latestEntryAt
    }));
    res.json({ data: compact });
  })
);

router.use("/tenants/:tenantId/departments", scopedDepartmentRouter);

export const departmentRouter = router;
