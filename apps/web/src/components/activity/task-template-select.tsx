"use client";

import type { TaskTemplate } from "@/lib/types";
import { Label, Select } from "@/components/ui/primitives";

export function TaskTemplateSelect({
  templates,
  value,
  onChange,
  disabled
}: {
  templates: TaskTemplate[];
  value: string;
  onChange: (taskTemplateId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor="task-template-select">Task Template</Label>
      <Select
        id="task-template-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      >
        <option value="">{disabled ? "Select department first" : "Select task template"}</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} (v{template.version})
          </option>
        ))}
      </Select>
    </div>
  );
}
