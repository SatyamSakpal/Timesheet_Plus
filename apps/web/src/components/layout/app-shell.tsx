"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useApiClient } from "@/hooks/use-api-client";
import { useMeQuery } from "@/hooks/use-me";
import { PERMISSIONS } from "@/lib/constants";
import { classNames } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { tenantRoutes } from "@/lib/tenant-routes";
import type { TenantRole } from "@/lib/types";

interface OverviewSidebarItem {
  href: string;
  label: string;
  scope: "" | "created" | "joined";
  icon: "dashboard" | "created" | "joined";
}

interface TenantSidebarItem {
  href: string;
  label: string;
  matchPrefix: string;
  icon:
    | "dashboard"
    | "users"
    | "activity"
    | "mine"
    | "review"
    | "roles"
    | "departments"
    | "invites"
    | "tasks";
}

const overviewSidebarItems: OverviewSidebarItem[] = [
  { href: "/app", label: "Dashboard", scope: "", icon: "dashboard" },
  { href: "/app?scope=created", label: "Created", scope: "created", icon: "created" },
  { href: "/app?scope=joined", label: "Joined", scope: "joined", icon: "joined" }
];

function SidebarIcon({ type }: { type: OverviewSidebarItem["icon"] | TenantSidebarItem["icon"] }) {
  if (type === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
        <rect x="13.5" y="3.5" width="7" height="5.5" rx="1.3" />
        <rect x="13.5" y="11.5" width="7" height="9" rx="1.3" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
      </svg>
    );
  }
  if (type === "created") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 6.5h8M3.5 12h8M3.5 17.5h8M13.5 6.5h7M13.5 12h7M13.5 17.5h7" />
      </svg>
    );
  }
  if (type === "joined") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 12h7M12 8.5v7" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }
  if (type === "activity") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M4 12h10M4 17h7" />
      </svg>
    );
  }
  if (type === "users") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8.5" cy="9" r="2.4" />
        <path d="M4.6 17c.7-2.2 2.1-3.3 4.3-3.3 2.1 0 3.6 1.1 4.3 3.3" />
        <circle cx="16.2" cy="9.6" r="2" />
        <path d="M13.6 17c.6-1.6 1.8-2.4 3.5-2.4 1.6 0 2.8.8 3.4 2.4" />
      </svg>
    );
  }
  if (type === "mine") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19c1.2-3 3.5-4.5 7-4.5S17.8 16 19 19" />
      </svg>
    );
  }
  if (type === "review") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (type === "roles") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.5 18.5 6v5.8c0 3.9-2.6 7.4-6.5 8.7-3.9-1.3-6.5-4.8-6.5-8.7V6L12 3.5Z" />
        <circle cx="12" cy="11" r="1.9" />
        <path d="M12 13v2.5" />
      </svg>
    );
  }
  if (type === "departments") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4.5" y="3.5" width="15" height="17" rx="1.8" />
        <path d="M8 7.5h2M14 7.5h2M8 11.5h2M14 11.5h2M8 15.5h2M14 15.5h2" />
        <path d="M10.5 20.5v-3.5h3v3.5" />
      </svg>
    );
  }
  if (type === "invites") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="m4.5 7 7.5 6L19.5 7" />
      </svg>
    );
  }
  if (type === "tasks") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="m3.5 6 1.5 1.5L6.8 5.7M3.5 12l1.5 1.5 1.8-1.8M3.5 18l1.5 1.5 1.8-1.8" />
      </svg>
    );
  }
  return null;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6.8 17h10.4a1 1 0 0 0 .8-1.6l-1.4-1.9a6.5 6.5 0 0 1-1.3-3.8V8.3a3.3 3.3 0 1 0-6.6 0v1.4a6.5 6.5 0 0 1-1.3 3.8L6 15.4a1 1 0 0 0 .8 1.6Z" />
      <path d="M10.3 18.8a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 5H5v14h5" />
      <path d="M14 8l4 4-4 4M18 12H8" />
    </svg>
  );
}

function OrganizationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="5.5" r="2.2" />
      <circle cx="6.5" cy="17.5" r="2.2" />
      <circle cx="12" cy="17.5" r="2.2" />
      <circle cx="17.5" cy="17.5" r="2.2" />
      <path d="M12 7.7v4.2M12 11.9H6.5M12 11.9h5.5" />
    </svg>
  );
}

function SidebarCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M7 5.5v13" />
      {collapsed ? <path d="m11 8 4 4-4 4" /> : <path d="m15 8-4 4 4 4" />}
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const apiClient = useApiClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const meQuery = useMeQuery();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem("timesheet_plus.sidebar_collapsed");
    setSidebarCollapsed(storedValue === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("timesheet_plus.sidebar_collapsed", sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  const scope = searchParams.get("scope") ?? "";
  const tenantMatch = pathname.match(/^\/app\/tenants\/([^/]+)/);
  const tenantIdFromPath = tenantMatch?.[1] ?? null;
  const tenantMembership = useMemo(
    () =>
      meQuery.data?.memberships.find(
        (membership) => membership.tenantId === tenantIdFromPath && membership.status === "active"
      ) ?? null,
    [meQuery.data?.memberships, tenantIdFromPath]
  );
  const rolesQuery = useQuery({
    queryKey: tenantIdFromPath ? queryKeys.roles(tenantIdFromPath) : ["roles", "none"],
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${tenantIdFromPath}/roles`),
    enabled: Boolean(tenantIdFromPath && tenantMembership && !tenantMembership.isOwner)
  });
  const tenantPermissions = useMemo(() => {
    if (!tenantMembership || tenantMembership.isOwner) {
      return new Set<string>();
    }
    const roleMap = new Map((rolesQuery.data ?? []).map((role) => [role.id, role]));
    const permissions = new Set<string>();
    for (const roleId of tenantMembership.roleIds) {
      const role = roleMap.get(roleId);
      if (!role) {
        continue;
      }
      for (const permission of role.permissionKeys) {
        permissions.add(permission);
      }
    }
    return permissions;
  }, [rolesQuery.data, tenantMembership]);
  const isTenantOwner = tenantMembership?.isOwner ?? false;
  const canViewDashboard =
    isTenantOwner ||
    tenantPermissions.has(PERMISSIONS.activityApprove) ||
    tenantPermissions.has(PERMISSIONS.reportView);
  const canViewUsers = canViewDashboard;
  const canManageActivities = isTenantOwner || tenantPermissions.has(PERMISSIONS.taskTemplateManage);
  const canViewHodReview = canViewDashboard;
  const canManageRoles = isTenantOwner || tenantPermissions.has(PERMISSIONS.roleManage);
  const canViewDepartments =
    isTenantOwner ||
    tenantPermissions.has(PERMISSIONS.departmentManage) ||
    tenantPermissions.has(PERMISSIONS.memberManage) ||
    tenantPermissions.has(PERMISSIONS.reportView);
  const canManageInvites = isTenantOwner || tenantPermissions.has(PERMISSIONS.memberManage);
  const tenantSidebarItems: TenantSidebarItem[] = tenantIdFromPath
    ? (() => {
        const items: TenantSidebarItem[] = [];
        if (canViewDashboard) {
          items.push({
            href: tenantRoutes.ownerDashboard(tenantIdFromPath),
            label: "Dashboard",
            matchPrefix: tenantRoutes.ownerDashboard(tenantIdFromPath),
            icon: "dashboard"
          });
        }
        if (canViewUsers) {
          items.push({
            href: tenantRoutes.users(tenantIdFromPath),
            label: "Users",
            matchPrefix: tenantRoutes.users(tenantIdFromPath),
            icon: "users"
          });
        }
        if (canViewHodReview) {
          items.push({
            href: tenantRoutes.hodReview(tenantIdFromPath),
            label: "HOD Review",
            matchPrefix: `/app/tenants/${tenantIdFromPath}/hod`,
            icon: "review"
          });
        }
        items.push({
          href: tenantRoutes.activityMine(tenantIdFromPath),
          label: "My Activity",
          matchPrefix: tenantRoutes.activityMine(tenantIdFromPath),
          icon: "mine"
        });
        if (canViewDepartments) {
          items.push({
            href: tenantRoutes.adminDepartments(tenantIdFromPath),
            label: "Departments",
            matchPrefix: tenantRoutes.adminDepartments(tenantIdFromPath),
            icon: "departments"
          });
        }
        if (canManageActivities) {
          items.push({
            href: tenantRoutes.activities(tenantIdFromPath),
            label: "Activities",
            matchPrefix: tenantRoutes.activities(tenantIdFromPath),
            icon: "tasks"
          });
        }
        if (canManageRoles) {
          items.push({
            href: tenantRoutes.adminRoles(tenantIdFromPath),
            label: "Roles",
            matchPrefix: tenantRoutes.adminRoles(tenantIdFromPath),
            icon: "roles"
          });
        }
        if (canManageInvites) {
          items.push({
            href: tenantRoutes.adminInvites(tenantIdFromPath),
            label: "Invites",
            matchPrefix: tenantRoutes.adminInvites(tenantIdFromPath),
            icon: "invites"
          });
        }
        return items;
      })()
    : [];
  const tenantNameFromMembership = tenantMembership?.tenantName ?? null;
  const tenantTitle = tenantIdFromPath ? tenantNameFromMembership ?? "Unnamed Tenant" : "Tenant Overview";
  const footerDashboardHref = "/app";
  const footerDashboardLabel = "My Organization";
  const userName = meQuery.data?.user.name ?? auth.user?.name ?? "User";
  const userEmail = meQuery.data?.user.email ?? auth.user?.email ?? "unknown@example.com";
  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .map((chunk) => chunk[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";
  const desktopGridColumns = sidebarCollapsed ? "md:grid-cols-[88px_1fr]" : "md:grid-cols-[256px_1fr]";

  return (
    <div className="min-h-screen bg-[#edeeef] text-[#191c1d] page-enter">
      <div
        className={classNames(
          "mx-auto min-h-screen max-w-[1440px] md:grid md:transition-[grid-template-columns] md:duration-300 md:ease-in-out",
          desktopGridColumns
        )}
      >
        <aside
          className={classNames(
            "flex flex-col overflow-x-hidden bg-[#f8fafc] p-4 transition-[padding] duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:max-h-screen md:self-start md:overflow-y-auto md:border-r md:border-[#e7e8e9]",
            sidebarCollapsed && "md:px-3"
          )}
        >
          <div className="pb-4 pt-2">
            <div
              className={classNames(
                "flex items-start transition-[gap] duration-300 ease-in-out",
                sidebarCollapsed ? "justify-center gap-0" : "justify-between gap-2"
              )}
            >
              <div
                className={classNames(
                  "min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                  sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
                )}
              >
                <h2 className="text-[18px] font-semibold leading-7 text-[#0f172a]" style={{ fontFamily: "var(--font-body), sans-serif" }}>
                  Timesheet+
                </h2>
                <p className={classNames("mt-1 text-xs text-[#64748b] transition-opacity duration-200", sidebarCollapsed && "opacity-0")}>
                  {tenantIdFromPath ? "Tenant Portal" : "Tenant Overview"}
                </p>
              </div>
              <button
                type="button"
                className={classNames(
                  "hidden h-9 w-9 place-items-center rounded-full text-[#475569] transition-all duration-300 ease-in-out hover:bg-[#edf0f4] md:grid",
                  sidebarCollapsed ? "mx-auto" : "ml-auto"
                )}
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <SidebarCollapseIcon collapsed={sidebarCollapsed} />
              </button>
            </div>
          </div>

          <div className="flex-1 pt-2">
            <nav className="space-y-1">
              {tenantIdFromPath
                ? tenantSidebarItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.matchPrefix);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-label={sidebarCollapsed ? item.label : undefined}
                        className={classNames(
                          "group relative flex items-center rounded-xl text-sm transition-[padding,background-color,color] duration-300 ease-in-out",
                          sidebarCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                          isActive
                            ? "bg-[#eff6ff] font-semibold text-[#1d4ed8]"
                            : "font-medium text-[#475569] hover:bg-[#edf0f4]"
                        )}
                      >
                        <SidebarIcon type={item.icon} />
                        <span
                          aria-hidden={sidebarCollapsed}
                          className={classNames(
                            "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                            sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })
                : overviewSidebarItems.map((item) => {
                    const isActive = pathname === "/app" && scope === item.scope;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-label={sidebarCollapsed ? item.label : undefined}
                        className={classNames(
                          "group relative flex items-center rounded-xl text-sm transition-[padding,background-color,color] duration-300 ease-in-out",
                          sidebarCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                          isActive
                            ? "bg-[#eff6ff] font-semibold text-[#1d4ed8]"
                            : "font-medium text-[#475569] hover:bg-[#edf0f4]"
                        )}
                      >
                        <SidebarIcon type={item.icon} />
                        <span
                          aria-hidden={sidebarCollapsed}
                          className={classNames(
                            "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                            sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
            </nav>
          </div>

          <div className="mt-4 border-t border-[#e2e8f0] pt-4">
            <Link
              href={footerDashboardHref}
              title={sidebarCollapsed ? footerDashboardLabel : undefined}
              aria-label={sidebarCollapsed ? footerDashboardLabel : undefined}
              className={classNames(
                "group relative mb-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#475569] transition-[padding,background-color,color] duration-300 ease-in-out hover:bg-[#edf0f4]",
                sidebarCollapsed ? "justify-center" : "gap-3"
              )}
            >
              <OrganizationIcon />
              <span
                aria-hidden={sidebarCollapsed}
                className={classNames(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                  sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"
                )}
              >
                {footerDashboardLabel}
              </span>
            </Link>
            <button
              type="button"
              title={sidebarCollapsed ? "Sign Out" : undefined}
              aria-label={sidebarCollapsed ? "Sign Out" : undefined}
              className={classNames(
                "group relative flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#475569] transition-[padding,background-color,color] duration-300 ease-in-out hover:bg-[#edf0f4]",
                sidebarCollapsed ? "justify-center" : "gap-3"
              )}
              onClick={() => {
                void auth.signOut();
              }}
            >
              <SignOutIcon />
              <span
                aria-hidden={sidebarCollapsed}
                className={classNames(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                  sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[100px] opacity-100"
                )}
              >
                Sign Out
              </span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="sticky top-0 z-10 border-b border-[#e7e8e9] bg-[rgba(255,255,255,0.8)] px-4 py-2 shadow-[0_12px_32px_rgba(25,28,29,0.06)] backdrop-blur-[12px] md:px-8 md:py-3">
            <div className="flex items-center justify-between gap-3">
                <h1
                  className="max-w-[420px] truncate text-left text-sm font-semibold tracking-wide text-[#0f172a] md:max-w-[620px] md:text-base"
                  title={tenantTitle}
                >
                  {tenantTitle}
                </h1>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full text-[#475569] transition hover:bg-[#edf0f4]"
                    aria-label="Notifications"
                  >
                    <BellIcon />
                  </button>
                  <div
                    title={userEmail}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#f4c7a8] text-xs font-semibold text-[#1f2937] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  >
                    {initials}
                  </div>
                </div>
            </div>
          </div>

          <main className="min-h-[calc(100vh-86px)] px-4 py-6 md:px-8 md:py-8">{children}</main>
        </section>
      </div>
    </div>
  );
}
