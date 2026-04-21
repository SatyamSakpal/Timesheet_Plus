import { Router } from "express";
import { activityRouter } from "./activity.routes";
import { catalogRouter } from "./catalog.routes";
import { departmentRouter } from "./department.routes";
import { meRouter } from "./me.routes";
import { taskRouter } from "./task.routes";
import { tenantRouter } from "./tenant.routes";

/**
 * v1 API module assembly.
 * Each sub-router owns one bounded context to keep handlers short and maintainable.
 */
const router = Router();

router.use(meRouter);
router.use(catalogRouter);
router.use(tenantRouter);
router.use(departmentRouter);
router.use(taskRouter);
router.use(activityRouter);

export const v1Router = router;
