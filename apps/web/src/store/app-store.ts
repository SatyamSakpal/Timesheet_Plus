"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface KnownDepartment {
  id: string;
  name?: string;
}

interface AppStoreState {
  activeTenantId: string | null;
  knownDepartmentsByTenant: Record<string, KnownDepartment[]>;
  setActiveTenantId: (tenantId: string | null) => void;
  addKnownDepartment: (tenantId: string, department: KnownDepartment) => void;
}

function mergeDepartment(
  existing: KnownDepartment[],
  next: KnownDepartment
): KnownDepartment[] {
  const index = existing.findIndex((department) => department.id === next.id);
  if (index === -1) {
    return [...existing, next];
  }
  const updated = [...existing];
  updated[index] = { ...updated[index], ...next };
  return updated;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      knownDepartmentsByTenant: {},
      setActiveTenantId: (tenantId) => set({ activeTenantId: tenantId }),
      addKnownDepartment: (tenantId, department) =>
        set((state) => ({
          knownDepartmentsByTenant: {
            ...state.knownDepartmentsByTenant,
            [tenantId]: mergeDepartment(
              state.knownDepartmentsByTenant[tenantId] ?? [],
              department
            )
          }
        }))
    }),
    {
      name: "timesheetplus-web-state",
      partialize: (state) => ({
        activeTenantId: state.activeTenantId,
        knownDepartmentsByTenant: state.knownDepartmentsByTenant
      })
    }
  )
);
