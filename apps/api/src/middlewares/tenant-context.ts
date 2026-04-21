import type { NextFunction, Request, Response } from "express";
import { badRequest, unauthorized } from "../errors/app-error";
import { getPlatformService } from "../services";

// Resolves tenant membership + effective permissions once per request.
export async function attachTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      unauthorized("Authentication required");
    }
    const tenantIdParam = req.params.tenantId;
    if (!tenantIdParam) {
      badRequest("tenantId route parameter is required");
    }
    const tenantId = Array.isArray(tenantIdParam) ? tenantIdParam[0] : tenantIdParam;

    const service = getPlatformService();
    req.tenantContext = await service.getTenantContext(tenantId, req.user.uid);
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.tenantContext) {
        unauthorized("Tenant context missing");
      }
      // Permission checks run against role-derived tenant context.
      const service = getPlatformService();
      await service.assertPermission(req.tenantContext, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
