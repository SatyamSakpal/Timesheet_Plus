"use client";

import type { TaskTemplate } from "@/lib/types";
import { Label } from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
      <Label htmlFor="task-template-select">Task</Label>
      <SearchableSelect
        id="task-template-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={disabled ? "Select department first" : "Select task"}
        options={[
          { value: "", label: disabled ? "Select department first" : "Select task" },
          ...templates.map((template) => ({ value: template.id, label: template.name }))
        ]}
      />
    </div>
  );
}
