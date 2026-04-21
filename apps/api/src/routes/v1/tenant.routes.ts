import { Router } from "express";
import { PERMISSIONS } from "../../constants/permissions";
import { unauthorized } from "../../errors/app-error";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { attachTenantContext, requirePermission } from "../../middlewares/tenant-context";
import { getPlatformService } from "../../services";
import { param } from "./helpers";
import {
  addMemberSchema,
  assignRoleSchema,
  createRoleSchema,
  createTenantSchema,
  inviteMemberSchema
} from "./schemas/tenant.schemas";

const router = Router();

router.post(
  "/tenants",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      unauthorized();
    }
    const input = createTenantSchema.parse(req.body);
    const service = getPlatformService();
    const tenant = await service.createTenant(input.name, req.user);
    res.status(201).json({ data: tenant });
  })
);

router.delete(
  "/tenants/:tenantId",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      unauthorized();
    }
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const tenant = await service.deleteTenant(tenantId, req.user);
    res.json({ data: tenant });
  })
);

router.post(
  "/tenants/:tenantId/invites/:inviteId/accept",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      unauthorized();
    }
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const inviteId = param(req, "inviteId");
    const membership = await service.acceptInvite(tenantId, inviteId, req.user);
    res.json({ data: membership });
  })
);

const scopedTenantRouter = Router({ mergeParams: true });
scopedTenantRouter.use(authenticate, attachTenantContext);

scopedTenantRouter.post(
  "/roles",
  requirePermission(PERMISSIONS.roleManage),
  asyncHandler(async (req, res) => {
    const input = createRoleSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const role = await service.createRole(tenantId, req.user!.uid, input);
    res.status(201).json({ data: role });
  })
);

scopedTenantRouter.get(
  "/roles",
  requirePermission(PERMISSIONS.roleManage),
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const roles = await service.listRoles(tenantId);
    res.json({ data: roles });
  })
);

scopedTenantRouter.get(
  "/members",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const members = await service.listTenantMembers(tenantId);
    res.json({ data: members });
  })
);

scopedTenantRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const directory = await service.listTenantUsersForOwnerOrHod(tenantId, req.user!.uid);
    res.json({ data: directory });
  })
);

scopedTenantRouter.post(
  "/invites",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const input = inviteMemberSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const invited = await service.inviteTenantMember(tenantId, input, req.user!.uid);
    res.status(201).json({ data: invited });
  })
);

scopedTenantRouter.get(
  "/invites",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const invites = await service.listTenantInvites(tenantId);
    res.json({ data: invites });
  })
);

scopedTenantRouter.post(
  "/members",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const input = addMemberSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const membership = await service.addTenantMember(tenantId, input, req.user!.uid);
    res.status(201).json({ data: membership });
  })
);

scopedTenantRouter.post(
  "/members/:memberUserId/roles",
  requirePermission(PERMISSIONS.memberManage),
  asyncHandler(async (req, res) => {
    const input = assignRoleSchema.parse(req.body);
    const service = getPlatformService();
    const tenantId = param(req, "tenantId");
    const memberUserId = param(req, "memberUserId");
    const membership = await service.assignRolesToMember(
      tenantId,
      memberUserId,
      input.roleIds,
      req.user!.uid
    );
    res.json({ data: membership });
  })
);

router.use("/tenants/:tenantId", scopedTenantRouter);

export const tenantRouter = router;
