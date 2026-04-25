"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { Select } from "@/components/ui/primitives";
import { classNames } from "@/lib/format";
import { tenantRoutes } from "@/lib/tenant-routes";

export function TenantSwitcher({
  className,
  showManage = true
}: {
  className?: string;
  showManage?: boolean;
}) {
  const { memberships, activeTenantId } = useActiveTenant();
  const router = useRouter();
  const setActiveTenantId = useAppStore((state) => state.setActiveTenantId);
  const visibleMemberships = memberships.filter((membership) => membership.status === "active");

  if (visibleMemberships.length === 0) {
    return null;
  }

  return (
    <div className={classNames("flex items-center gap-2", className)}>
      <Select
        value={activeTenantId ?? ""}
        onChange={(event) => {
          const nextTenantId = event.target.value;
          setActiveTenantId(nextTenantId);
          router.push(tenantRoutes.root(nextTenantId));
        }}
        className="min-w-[210px]"
      >
        {visibleMemberships.map((membership) => (
          <option key={membership.id} value={membership.tenantId}>
            {(membership.tenantName ?? "Unnamed Tenant")} ({membership.status})
          </option>
        ))}
      </Select>
      {showManage ? (
        <Link className="text-sm text-brand-moss underline" href="/app/tenants">
          Manage
        </Link>
      ) : null}
    </div>
  );
}
