"use client";

import { InviteForm } from "@/components/admin/invite-form";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";

export default function AdminInvitesPage() {
  const { activeTenantId } = useActiveTenant();
  if (!activeTenantId) {
    return <TenantRequired />;
  }
  return <InviteForm tenantId={activeTenantId} />;
}
