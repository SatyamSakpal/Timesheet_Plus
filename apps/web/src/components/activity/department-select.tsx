"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { Button, Input, Label, Select } from "@/components/ui/primitives";

export function DepartmentSelect({
  tenantId,
  value,
  homeDepartmentId,
  onChange
}: {
  tenantId: string;
  value: string;
  homeDepartmentId: string | null;
  onChange: (departmentId: string) => void;
}) {
  const departments = useAppStore((state) => state.knownDepartmentsByTenant[tenantId] ?? []);
  const addKnownDepartment = useAppStore((state) => state.addKnownDepartment);
  const [manualDepartmentId, setManualDepartmentId] = useState("");

  const options = useMemo(() => {
    if (!homeDepartmentId) {
      return departments;
    }
    const exists = departments.some((department) => department.id === homeDepartmentId);
    if (exists) {
      return departments;
    }
    return [{ id: homeDepartmentId, name: "Home Department" }, ...departments];
  }, [departments, homeDepartmentId]);

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor="department-select">Work Department</Label>
        <Select
          id="department-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        >
          <option value="">Select department</option>
          {options.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name ? `${department.name} (${department.id})` : department.id}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Input
          value={manualDepartmentId}
          onChange={(event) => setManualDepartmentId(event.target.value)}
          placeholder="Add department id manually"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const departmentId = manualDepartmentId.trim();
            if (!departmentId) {
              return;
            }
            addKnownDepartment(tenantId, { id: departmentId });
            onChange(departmentId);
            setManualDepartmentId("");
          }}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-brand-moss">
        Backend currently exposes department-specific queries. Add department IDs once and reuse them.
      </p>
    </div>
  );
}
