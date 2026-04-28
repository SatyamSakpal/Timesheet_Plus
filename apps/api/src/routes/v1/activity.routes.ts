import { Router } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import { badRequest, forbidden } from "../../errors/app-error";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { attachTenantContext } from "../../middlewares/tenant-context";
import { getPlatformService } from "../../services";
import { type ActivityStatus } from "../../types/domain";
import { param } from "./helpers";
import {
  createActivitySchema,
  rejectActivitySchema,
  resubmitActivitySchema,
  updateActivitySchema
} from "./schemas/activity.schemas";

const router = Router();
const scopedTenantRouter = Router({ mergeParams: true });

scopedTenantRouter.use(authenticate, attachTenantContext);

async function resolveDepartmentScope(
  tenantId: string,
  userId: string,
  departmentId: string,
  isOwner: boolean
): Promise<{ managedDepartmentIds: string[]; isManagedByHod: boolean }> {
  if (isOwner) {
    return { managedDepartmentIds: [], isManagedByHod: false };
  }

  const service = getPlatformService();
  const managedDepartmentIds = await service.listManagedDepartmentIds(tenantId, userId);
  const isManagedByHod = managedDepartmentIds.includes(departmentId);

  if (managedDepartmentIds.length > 0 && !isManagedByHod) {
    forbidden("HOD can only access activity logs in managed departments");
  }

  return { managedDepartmentIds, isManagedByHod };
}

scopedTenantRouter.post(
  "/activities",
  asyncHandler(async (req, res) => {
    const input = createActivitySchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activity = await service.createActivity(tenantId, req.user!, input);
    res.status(201).json({ data: activity });
  })
);

scopedTenantRouter.get(
  "/activities/my",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const status = req.query.status;
    if (status && !["draft", "submitted", "approved", "rejected", "resubmitted"].includes(String(status))) {
      badRequest("Invalid status filter");
    }

    const activities = await service.listMyActivities(tenantId, req.user!.uid, {
      status: status ? (String(status) as ActivityStatus) : undefined,
      departmentId: req.query.departmentId ? String(req.query.departmentId) : undefined,
      dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
      dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
    });
    res.json({ data: activities });
  })
);

scopedTenantRouter.get(
  "/departments/:departmentId/activities",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const departmentId = param(req, "departmentId");
    const scope = await resolveDepartmentScope(
      tenantId,
      req.user!.uid,
      departmentId,
      req.tenantContext!.isOwner
    );
    const canView =
      req.tenantContext!.isOwner ||
      scope.isManagedByHod ||
      (scope.managedDepartmentIds.length === 0 &&
        req.tenantContext!.permissions.has(PERMISSIONS.reportView));
    if (!canView) {
      forbidden("Only owner/HOD/report viewers can access department activities");
    }

    const status = req.query.status;
    if (status && !["draft", "submitted", "approved", "rejected", "resubmitted"].includes(String(status))) {
      badRequest("Invalid status filter");
    }
    const activities = await service.listDepartmentActivities(tenantId, departmentId, {
      status: status ? (String(status) as ActivityStatus) : undefined,
      userId: req.query.userId ? String(req.query.userId) : undefined,
      taskTemplateId: req.query.taskTemplateId ? String(req.query.taskTemplateId) : undefined,
      dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
      dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
    });
    res.json({ data: activities });
  })
);

scopedTenantRouter.post(
  "/activities/:activityId/approve",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activityId = param(req, "activityId");
    const activity = await service.getActivityOrThrow(tenantId, activityId);
    const scope = await resolveDepartmentScope(
      tenantId,
      req.user!.uid,
      activity.workDepartmentId,
      req.tenantContext!.isOwner
    );
    const canApprove =
      req.tenantContext!.isOwner ||
      scope.isManagedByHod ||
      (scope.managedDepartmentIds.length === 0 &&
        req.tenantContext!.permissions.has(PERMISSIONS.activityApprove));
    if (!canApprove) {
      forbidden("Only assigned HOD/owner/approver role can approve this activity");
    }
    const next = await service.approveActivity(tenantId, activityId, req.user!.uid);
    res.json({ data: next });
  })
);

scopedTenantRouter.post(
  "/activities/:activityId/reject",
  asyncHandler(async (req, res) => {
    const input = rejectActivitySchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activityId = param(req, "activityId");
    const activity = await service.getActivityOrThrow(tenantId, activityId);
    const scope = await resolveDepartmentScope(
      tenantId,
      req.user!.uid,
      activity.workDepartmentId,
      req.tenantContext!.isOwner
    );
    const canReject =
      req.tenantContext!.isOwner ||
      scope.isManagedByHod ||
      (scope.managedDepartmentIds.length === 0 &&
        req.tenantContext!.permissions.has(PERMISSIONS.activityApprove));
    if (!canReject) {
      forbidden("Only assigned HOD/owner/approver role can reject this activity");
    }
    const next = await service.rejectActivity(tenantId, activityId, req.user!.uid, input.reason);
    res.json({ data: next });
  })
);

scopedTenantRouter.post(
  "/activities/:activityId/resubmit",
  asyncHandler(async (req, res) => {
    const input = resubmitActivitySchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activityId = param(req, "activityId");
    const next = await service.resubmitActivity(tenantId, activityId, req.user!.uid, input.payload);
    res.json({ data: next });
  })
);

scopedTenantRouter.patch(
  "/activities/:activityId",
  asyncHandler(async (req, res) => {
    const input = updateActivitySchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activityId = param(req, "activityId");
    const next = await service.editOwnActivity(tenantId, activityId, req.user!.uid, input);
    res.json({ data: next });
  })
);

scopedTenantRouter.delete(
  "/activities/:activityId",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const activityId = param(req, "activityId");
    await service.deleteOwnPendingActivity(tenantId, activityId, req.user!.uid);
    res.status(204).send();
  })
);

router.use("/tenants/:tenantId", scopedTenantRouter);

export const activityRouter = router;
