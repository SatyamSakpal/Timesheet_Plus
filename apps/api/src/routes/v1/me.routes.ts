import { Router } from "express";
import { unauthorized } from "../../errors/app-error";
import { authenticate } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/async-handler";
import { getDataStore } from "../../repositories";
import { getPlatformService } from "../../services";
import { COLLECTIONS, type TenantEntity, type TenantMembershipEntity } from "../../types/domain";

const router = Router();
const shouldLogDebug = process.env.NODE_ENV !== "test";

function logMeDebug(message: string, details?: Record<string, unknown>) {
  if (!shouldLogDebug) {
    return;
  }
  if (details) {
    console.debug(`[api:/v1/me] ${message}`, details);
    return;
  }
  console.debug(`[api:/v1/me] ${message}`);
}

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      unauthorized();
    }
    let stage = "initial";
    try {
      logMeDebug("Request received", {
        userId: req.user.uid,
        method: req.method,
        path: req.originalUrl
      });

      stage = "service-init";
      const service = getPlatformService();
      const store = getDataStore();

      stage = "upsert-user-profile";
      const user = await service.upsertUserProfile(req.user);
      logMeDebug("User profile resolved", {
        userId: user.id,
        email: user.email
      });

      stage = "load-memberships";
      const memberships = await store.query<TenantMembershipEntity>(COLLECTIONS.tenantMemberships, [
        { field: "userId", op: "==", value: req.user.uid }
      ]);
      logMeDebug("Memberships fetched", {
        count: memberships.length
      });

      stage = "load-tenants";
      const uniqueTenantIds = [...new Set(memberships.map((membership) => membership.tenantId))];
      const tenants = await Promise.all(
        uniqueTenantIds.map((tenantId) => store.getById<TenantEntity>(COLLECTIONS.tenants, tenantId))
      );
      const tenantMap = new Map(
        tenants
          .filter((tenant): tenant is TenantEntity => Boolean(tenant && !tenant.deletedAt))
          .map((tenant) => [tenant.id, tenant])
      );
      logMeDebug("Tenants hydrated", {
        requestedTenantIds: uniqueTenantIds.length,
        activeTenants: tenantMap.size
      });

      stage = "compose-response";
      const membershipsWithTenant = memberships
        .filter((membership) => tenantMap.has(membership.tenantId))
        .map((membership) => {
          const tenant = tenantMap.get(membership.tenantId)!;
          return {
            ...membership,
            tenantName: tenant.name,
            isOwner: tenant.ownerIds.includes(req.user!.uid)
          };
        });

      stage = "load-pending-invites";
      const pendingInvites = await service.listPendingInvitesForUser(req.user);

      logMeDebug("Response ready", {
        membershipCount: membershipsWithTenant.length,
        pendingInviteCount: pendingInvites.length
      });
      res.json({ data: { user, memberships: membershipsWithTenant, pendingInvites } });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[api:/v1/me] Request failed", {
        stage,
        userId: req.user.uid,
        message: err.message,
        stack: err.stack
      });
      throw error;
    }
  })
);

export const meRouter = router;
