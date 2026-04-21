import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { getPlatformService } from "../../services";

const router = Router();
router.use(authenticate);

router.get(
  "/catalog/permissions",
  asyncHandler(async (_req, res) => {
    const service = getPlatformService();
    const permissions = await service.listPermissionCatalog();
    res.json({ data: permissions });
  })
);

router.get(
  "/catalog/fields",
  asyncHandler(async (_req, res) => {
    const service = getPlatformService();
    const fields = await service.listFieldCatalog();
    res.json({ data: fields });
  })
);

export const catalogRouter = router;

