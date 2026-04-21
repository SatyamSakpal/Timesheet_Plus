"use client";

import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { tenantRoutes } from "@/lib/tenant-routes";

export function TenantRequired() {
  const { activeTenantId } = useActiveTenant();
  return (
    <Card>
      <SectionTitle title="Select a tenant to continue" />
      <p className="text-sm text-brand-moss">
        You need an active tenant context before using app features.
      </p>
      {activeTenantId ? (
        <Link
          href={tenantRoutes.root(activeTenantId)}
          className="mt-3 inline-block text-sm font-semibold text-brand-moss underline"
        >
          Open active tenant
        </Link>
      ) : (
        <Link href="/app/tenants" className="mt-3 inline-block text-sm font-semibold text-brand-moss underline">
          Go to tenant selection
        </Link>
      )}
    </Card>
  );
}
