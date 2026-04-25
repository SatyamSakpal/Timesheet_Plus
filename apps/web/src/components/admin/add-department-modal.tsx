"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DepartmentEntity, TenantMemberListItem } from "@/lib/types";
import { Button, InlineError } from "@/components/ui/primitives";

interface AddDepartmentModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (department: DepartmentEntity) => void;
}

export function AddDepartmentModal({
  tenantId,
  isOpen,
  onClose,
  onCreated
}: AddDepartmentModalProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [departmentName, setDepartmentName] = useState("");
  const [hodEmail, setHodEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: queryKeys.tenantMembers(tenantId),
    queryFn: () => apiClient.get<TenantMemberListItem[]>(`/v1/tenants/${tenantId}/members`),
    enabled: isOpen
  });

  const emailToUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      if (member.status !== "active") {
        continue;
      }
      map.set(member.email.trim().toLowerCase(), member.userId);
    }
    return map;
  }, [membersQuery.data]);

  const sortedEmails = useMemo(
    () => [...emailToUserId.keys()].sort((left, right) => left.localeCompare(right)),
    [emailToUserId]
  );

  const createDepartmentMutation = useMutation({
    mutationFn: async (input: { name: string; hodUserId: string }) => {
      const department = await apiClient.post<DepartmentEntity>(`/v1/tenants/${tenantId}/departments`, {
        body: { name: input.name }
      });
      try {
        await apiClient.post(`/v1/tenants/${tenantId}/departments/${department.id}/hods`, {
          body: { userId: input.hodUserId }
        });
      } catch (nextError) {
        const detail =
          nextError instanceof Error ? nextError.message : "Failed to assign HOD after department creation.";
        throw new Error(`Department "${department.name}" created, but HOD assignment failed: ${detail}`);
      }
      return department;
    },
    onSuccess: async (department) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantDepartments(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantMembers(tenantId) })
      ]);
      onCreated?.(department);
      setDepartmentName("");
      setHodEmail("");
      setError(null);
      onClose();
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create department.");
    }
  });

  if (!isOpen) {
    return null;
  }

  function handleClose() {
    if (createDepartmentMutation.isPending) {
      return;
    }
    setError(null);
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = departmentName.trim();
    const email = hodEmail.trim().toLowerCase();
    if (!name) {
      setError("Department name is required.");
      return;
    }
    if (!email) {
      setError("HOD email is required.");
      return;
    }

    const hodUserId = emailToUserId.get(email);
    if (!hodUserId) {
      setError("Select a valid HOD email from tenant members.");
      return;
    }

    createDepartmentMutation.mutate({ name, hodUserId });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4"
      onClick={handleClose}
    >
      <section
        className="w-full max-w-xl rounded-xl bg-white p-6 shadow-[0_18px_52px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
              Add Department
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Create a department and assign its HOD from active tenant members.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-[#64748b] hover:bg-[#f1f5f9]"
            onClick={handleClose}
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="new-department-name"
              className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]"
            >
              Department Name
            </label>
            <input
              id="new-department-name"
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              required
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
              placeholder="Engineering"
            />
          </div>

          <div>
            <label
              htmlFor="new-department-hod-email"
              className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]"
            >
              HOD Email
            </label>
            <input
              id="new-department-hod-email"
              type="email"
              list="new-department-hod-email-options"
              value={hodEmail}
              onChange={(event) => setHodEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#0d56d0] focus:ring-2 focus:ring-[#bfdbfe]"
              placeholder="hod@tenant.com"
            />
            <datalist id="new-department-hod-email-options">
              {sortedEmails.map((email) => (
                <option key={email} value={email} />
              ))}
            </datalist>
            {membersQuery.isLoading ? (
              <p className="mt-1 text-xs text-[#64748b]">Loading tenant members...</p>
            ) : null}
            {membersQuery.error ? (
              <p className="mt-1 text-xs text-[#b42318]">
                {membersQuery.error instanceof Error ? membersQuery.error.message : "Failed to load tenant members."}
              </p>
            ) : null}
          </div>

          <InlineError message={error} />

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDepartmentMutation.isPending || membersQuery.isLoading || sortedEmails.length === 0}
            >
              {createDepartmentMutation.isPending ? "Creating..." : "Create Department"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
