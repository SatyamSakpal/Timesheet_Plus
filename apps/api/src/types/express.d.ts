import type { AuthenticatedUser, TenantContext } from "./domain";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantContext?: TenantContext;
    }
  }
}

export {};
