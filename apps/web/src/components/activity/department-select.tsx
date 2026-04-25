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
  const [manualDepartmentRef, setManualDepartmentRef] = useState("");

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
              {department.name || "Unnamed department"}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Input
          value={manualDepartmentRef}
          onChange={(event) => setManualDepartmentRef(event.target.value)}
          placeholder="Add department manually"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const departmentId = manualDepartmentRef.trim();
            if (!departmentId) {
              return;
            }
            addKnownDepartment(tenantId, { id: departmentId });
            onChange(departmentId);
            setManualDepartmentRef("");
          }}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-brand-moss">
        If a department is missing, you can add it manually and reuse it later.
      </p>
    </div>
  );
}
