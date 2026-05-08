"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, InlineError, Input } from "@/components/ui/primitives";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { useMeQuery } from "@/hooks/use-me";
import { resolveTenantPortalRoute } from "@/lib/portal-routing";
import { queryKeys } from "@/lib/query-keys";
import type { PendingInvite, TenantMembership, TenantRole } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

interface CreatedTenant {
  id: string;
  name: string;
}

function UniversityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M3 9.5 12 5l9 4.5L12 14 3 9.5Z" />
      <path d="M6 12.5v4.5M10 14v3M14 14v3M18 12.5v4.5M4 19.5h16" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M9 3h6M10 3v5l-4.5 7.5a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3L14 8V3" />
      <path d="M8.5 14h7" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8 8.5a3.5 3.5 0 0 1 7 0v7a3.5 3.5 0 0 1-7 0v-7Z" />
      <path d="M8.5 11.5H6a2 2 0 1 1 0-4h2M15.5 11.5H18a2 2 0 1 0 0-4h-2M8.5 15.5H6a2 2 0 0 0 0 4h2M15.5 15.5H18a2 2 0 0 1 0 4h-2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="space-y-1">
        <h2 className="text-[30px] font-bold leading-9 text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
          {title}
        </h2>
        <p className="text-base text-[#424654]">{subtitle}</p>
      </div>
      <div className="hidden h-px flex-1 bg-[rgba(195,198,214,0.2)] lg:block" />
    </div>
  );
}

function CreateInstitutionCard({ onClick }: { onClick: () => void }) {
  return (
    <article className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-[rgba(195,198,214,0.4)] px-4 py-4">
      <button type="button" onClick={onClick} className="text-center text-[#424654]">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e7e8e9] text-[#0040a3]">
          <PlusIcon />
        </span>
        <span className="text-sm font-semibold leading-5">Create New Institution</span>
      </button>
    </article>
  );
}

function OwnedInstitutionCard({
  membership,
  onEnter,
  onDelete,
  index,
  isDeleting,
  isEntering
}: {
  membership: TenantMembership;
  onEnter: (membership: TenantMembership) => void | Promise<void>;
  onDelete: (membership: TenantMembership) => void;
  index: number;
  isDeleting: boolean;
  isEntering: boolean;
}) {
  const iconBg = index % 2 === 0 ? "bg-[#eff6ff] text-[#0040a3]" : "bg-[#ffdbcf] text-[#9d2e00]";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  return (
    <article className="flex aspect-square w-full max-w-[220px] flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
      <div className="flex items-start justify-between pb-4">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${iconBg}`}>
          <UniversityIcon />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-[#dae2ff] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.4px] text-[#001848]">
            Owner
          </span>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#edf0f4]"
              aria-label="Open tenant actions"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <KebabIcon />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-9 z-20 min-w-[148px] rounded-lg border border-[#e5e7eb] bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#b42318] transition hover:bg-[#fef3f2] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(membership);
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete institution"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold leading-5 text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
          {membership.tenantName ?? "Unnamed Institution"}
        </h3>
      </div>

      <div className="mt-4 border-t border-[rgba(195,198,214,0.1)] pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e7e8e9] py-2 text-xs font-semibold text-[#191c1d] transition hover:brightness-95"
          onClick={() => onEnter(membership)}
          disabled={isEntering}
        >
          <span>{isEntering ? "Opening..." : "Enter Portal"}</span>
          <ArrowRightIcon />
        </button>
      </div>
    </article>
  );
}

function JoinedFeaturedCard({
  membership,
  onEnter,
  isEntering
}: {
  membership: TenantMembership;
  onEnter: (membership: TenantMembership) => void | Promise<void>;
  isEntering: boolean;
}) {
  return (
    <article className="grid min-h-[263px] overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(25,28,29,0.06)] md:grid-cols-[112px_1fr]">
      <div className="grid place-items-center bg-[#a6b8ea] p-6">
        <div className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#dbe5ff] text-[#4d618f]">
          <UniversityIcon />
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
        <h3 className="text-[36px] font-bold leading-9 text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
          {membership.tenantName ?? "Joined Institution"}
        </h3>
          <span className="text-[#6b7280]">
            <KebabIcon />
          </span>
        </div>

        <button
          type="button"
          className="mt-8 w-full rounded-xl bg-gradient-to-br from-[#0040a3] to-[#0d56d0] py-2.5 text-base font-semibold text-white transition hover:brightness-110"
          onClick={() => onEnter(membership)}
          disabled={isEntering}
        >
          {isEntering ? "Opening..." : "Enter Portal"}
        </button>
      </div>
    </article>
  );
}

function JoinedCompactCard({
  membership,
  onEnter,
  variant,
  isEntering
}: {
  membership: TenantMembership;
  onEnter: (membership: TenantMembership) => void | Promise<void>;
  variant: "lab" | "cog";
  isEntering: boolean;
}) {
  return (
    <article className="flex min-h-[263px] flex-col items-center rounded-2xl bg-white p-6 text-center shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f3f4f5] text-[#0040a3]">
        {variant === "lab" ? <FlaskIcon /> : <BrainIcon />}
      </div>
      <h4 className="mt-4 text-[18px] font-bold leading-7 text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
        {membership.tenantName ?? "Joined Tenant"}
      </h4>
      <button
        type="button"
        className="mt-6 w-full rounded-xl bg-[#edeeef] py-2 text-base font-semibold text-[#424654] transition hover:bg-[#e2e3e7]"
        onClick={() => onEnter(membership)}
        disabled={isEntering}
      >
        {isEntering ? "Opening..." : "Enter"}
      </button>
    </article>
  );
}

function PendingInviteCard({
  invite,
  onAccept,
  onReject,
  isAccepting,
  isRejecting
}: {
  invite: PendingInvite;
  onAccept: (invite: PendingInvite) => void;
  onReject: (invite: PendingInvite) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}) {
  return (
    <article className="flex min-h-[220px] flex-col rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8]">Pending Invite</p>
          <h4 className="mt-2 text-xl font-bold text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
            {invite.tenantName}
          </h4>
        </div>
        <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[10px] font-semibold uppercase text-[#1d4ed8]">
          {invite.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-[#424654]">
        Roles: {invite.roleNames.length > 0 ? invite.roleNames.join(", ") : "Staff"}
      </p>
      <p className="mt-1 text-xs text-[#64748b]">
        Invited by {invite.invitedByName ?? "Team Admin"}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          className="w-full rounded-xl border border-[#fecaca] bg-[#fff1f2] py-2.5 text-sm font-semibold text-[#b42318] transition hover:bg-[#ffe4e8] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onReject(invite)}
          disabled={isRejecting || isAccepting}
        >
          {isRejecting ? "Rejecting..." : "Reject"}
        </button>
        <button
          type="button"
          className="w-full rounded-xl bg-gradient-to-br from-[#0040a3] to-[#0d56d0] py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onAccept(invite)}
          disabled={isAccepting || isRejecting}
        >
          {isAccepting ? "Accepting..." : "Accept"}
        </button>
      </div>
    </article>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { memberships } = useActiveTenant();
  const meQuery = useMeQuery();
  const activeTenantId = useAppStore((state) => state.activeTenantId);
  const setActiveTenantId = useAppStore((state) => state.setActiveTenantId);

  const [tenantName, setTenantName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [enteringTenantId, setEnteringTenantId] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [rejectingInviteId, setRejectingInviteId] = useState<string | null>(null);
  const scope = searchParams.get("scope") ?? "";
  const pendingInvites = useMemo(() => meQuery.data?.pendingInvites ?? [], [meQuery.data?.pendingInvites]);

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === "active"),
    [memberships]
  );
  const ownedTenants = useMemo(
    () => activeMemberships.filter((membership) => membership.isOwner),
    [activeMemberships]
  );
  const joinedTenants = useMemo(
    () => activeMemberships.filter((membership) => !membership.isOwner),
    [activeMemberships]
  );

  const showOwned = scope === "" || scope === "created";
  const showJoined = scope === "" || scope === "joined";

  const createTenantMutation = useMutation({
    mutationFn: (name: string) => apiClient.post<CreatedTenant>("/v1/tenants", { body: { name } }),
    onSuccess: async (tenant) => {
      setTenantName("");
      setShowCreateInput(false);
      setError(null);
      setActiveTenantId(tenant.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create tenant.");
    }
  });

  const deleteTenantMutation = useMutation({
    mutationFn: (tenantId: string) => apiClient.delete(`/v1/tenants/${tenantId}`),
    onMutate: (tenantId) => {
      setDeletingTenantId(tenantId);
    },
    onSuccess: async (_tenant, tenantId) => {
      setError(null);
      if (activeTenantId === tenantId) {
        setActiveTenantId(null);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete tenant.");
    },
    onSettled: () => {
      setDeletingTenantId(null);
    }
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (input: { tenantId: string; inviteId: string }) =>
      apiClient.post<TenantMembership>(`/v1/tenants/${input.tenantId}/invites/${input.inviteId}/accept`),
    onMutate: (input) => {
      setAcceptingInviteId(input.inviteId);
    },
    onSuccess: async () => {
      setPortalError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (nextError) => {
      setPortalError(nextError instanceof Error ? nextError.message : "Failed to accept invite.");
    },
    onSettled: () => {
      setAcceptingInviteId(null);
    }
  });

  const rejectInviteMutation = useMutation({
    mutationFn: (input: { tenantId: string; inviteId: string }) =>
      apiClient.post(`/v1/tenants/${input.tenantId}/invites/${input.inviteId}/reject`),
    onMutate: (input) => {
      setRejectingInviteId(input.inviteId);
    },
    onSuccess: async () => {
      setPortalError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (nextError) => {
      setPortalError(nextError instanceof Error ? nextError.message : "Failed to reject invite.");
    },
    onSettled: () => {
      setRejectingInviteId(null);
    }
  });

  async function openTenantPortal(membership: TenantMembership) {
    if (enteringTenantId) {
      return;
    }

    setPortalError(null);
    setEnteringTenantId(membership.tenantId);
    setActiveTenantId(membership.tenantId);

    try {
      let permissions = new Set<string>();
      if (!membership.isOwner) {
        const roles = await apiClient.get<TenantRole[]>(`/v1/tenants/${membership.tenantId}/roles`);
        const roleMap = new Map(roles.map((role) => [role.id, role]));
        permissions = membership.roleIds.reduce((collected, roleId) => {
          const role = roleMap.get(roleId);
          if (!role) {
            return collected;
          }
          role.permissionKeys.forEach((permission) => collected.add(permission));
          return collected;
        }, new Set<string>());
      }
      const destination = resolveTenantPortalRoute(membership, permissions);
      router.push(destination);
    } catch (nextError) {
      setPortalError(
        nextError instanceof Error
          ? nextError.message
          : "We could not resolve portal permissions. Try again."
      );
      router.push(resolveTenantPortalRoute(membership, new Set<string>()));
    } finally {
      setEnteringTenantId(null);
    }
  }

  function onCreateTenant() {
    setError(null);
    const name = tenantName.trim();
    if (!name) {
      setError("Institution name is required.");
      return;
    }
    createTenantMutation.mutate(name);
  }

  function onDeleteTenant(membership: TenantMembership) {
    if (deleteTenantMutation.isPending) {
      return;
    }
    const name = membership.tenantName ?? "this institution";
    const confirmed = window.confirm(
      `Delete "${name}"? This marks the tenant as deleted and removes it from your dashboard.`
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    deleteTenantMutation.mutate(membership.tenantId);
  }

  function onAcceptInvite(invite: PendingInvite) {
    if (acceptInviteMutation.isPending) {
      return;
    }
    setPortalError(null);
    acceptInviteMutation.mutate({ tenantId: invite.tenantId, inviteId: invite.id });
  }

  function onRejectInvite(invite: PendingInvite) {
    if (rejectInviteMutation.isPending) {
      return;
    }
    setPortalError(null);
    rejectInviteMutation.mutate({ tenantId: invite.tenantId, inviteId: invite.id });
  }

  const dashboardOwned = ownedTenants;
  const dashboardJoinedMain = joinedTenants[0];
  const dashboardJoinedSecondary = joinedTenants.slice(1, 3);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-16">
      <InlineError message={portalError} />
      {showOwned ? (
        <section className="space-y-8">
          <SectionHeader title="My Institutions" subtitle="Entities created and managed by you." />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,220px))] justify-start gap-4">
            <CreateInstitutionCard onClick={() => setShowCreateInput((current) => !current)} />

            {dashboardOwned.map((membership, index) => (
              <OwnedInstitutionCard
                key={membership.id}
                membership={membership}
                onEnter={openTenantPortal}
                onDelete={onDeleteTenant}
                index={index}
                isDeleting={deletingTenantId === membership.tenantId}
                isEntering={enteringTenantId === membership.tenantId}
              />
            ))}
          </div>

          {showCreateInput ? (
            <div className="rounded-2xl bg-white p-6 shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
              <h3 className="text-xl font-bold text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                Create Institution
              </h3>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  placeholder="Institution name"
                  className="h-11 rounded-xl border-[#d8dde6]"
                />
                <Button
                  onClick={onCreateTenant}
                  disabled={createTenantMutation.isPending}
                  className="h-11 rounded-xl bg-gradient-to-br from-[#0040a3] to-[#0d56d0] px-6 hover:brightness-110"
                >
                  {createTenantMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
              <InlineError message={error} />
            </div>
          ) : null}
        </section>
      ) : null}

      {showJoined ? (
        <section className="space-y-8">
          <SectionHeader title="Joined Organizations" subtitle="Institutions where you are a member or collaborator." />
          {pendingInvites.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#191c1d]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
                Invitation Requests
              </h3>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {pendingInvites.map((invite) => (
                  <PendingInviteCard
                    key={invite.id}
                    invite={invite}
                    onAccept={onAcceptInvite}
                    onReject={onRejectInvite}
                    isAccepting={acceptingInviteId === invite.id}
                    isRejecting={rejectingInviteId === invite.id}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {dashboardJoinedMain ? (
            <div className="grid gap-8 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <JoinedFeaturedCard
                  membership={dashboardJoinedMain}
                  onEnter={openTenantPortal}
                  isEntering={enteringTenantId === dashboardJoinedMain.tenantId}
                />
              </div>

              {dashboardJoinedSecondary.map((membership, index) => (
                <JoinedCompactCard
                  key={membership.id}
                  membership={membership}
                  onEnter={openTenantPortal}
                  variant={index % 2 === 0 ? "lab" : "cog"}
                  isEntering={enteringTenantId === membership.tenantId}
                />
              ))}

              {dashboardJoinedSecondary.length === 0 ? (
                <article className="rounded-2xl bg-white p-6 text-base text-[#424654] shadow-[0_12px_32px_rgba(25,28,29,0.06)] lg:col-span-2">
                  No additional joined organizations.
                </article>
              ) : null}
            </div>
          ) : (
            <article className="rounded-2xl bg-white p-6 text-base text-[#424654] shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
              No joined organizations found.
            </article>
          )}
        </section>
      ) : null}
    </div>
  );
}
