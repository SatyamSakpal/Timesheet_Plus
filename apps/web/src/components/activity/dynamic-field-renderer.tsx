"use client";

import type { TaskFieldSchema } from "@/lib/types";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";

function asString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

export function DynamicFieldRenderer({
  fields,
  values,
  onChange
}: {
  fields: TaskFieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-brand-moss">No fields configured for this template.</p>;
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const fieldId = `field-${field.key}`;
        const required = field.required ? " *" : "";
        const currentValue = values[field.key];

        if (field.type === "textarea") {
          return (
            <div key={field.key}>
              <Label htmlFor={fieldId}>
                {field.label}
                {required}
              </Label>
              <Textarea
                id={fieldId}
                rows={4}
                value={asString(currentValue)}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.key}>
              <Label htmlFor={fieldId}>
                {field.label}
                {required}
              </Label>
              <Select
                id={fieldId}
                value={asString(currentValue)}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                <option value="">Select</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          );
        }

        if (field.type === "radio") {
          return (
            <div key={field.key}>
              <Label>
                {field.label}
                {required}
              </Label>
              <div className="mt-2 space-y-2 rounded-md border border-brand-mist bg-white px-3 py-2">
                {(field.options ?? []).map((option, index) => {
                  const optionId = `${fieldId}-${index}`;
                  return (
                    <label key={option} htmlFor={optionId} className="flex items-center gap-2 text-sm text-brand-slate">
                      <input
                        id={optionId}
                        type="radio"
                        name={fieldId}
                        value={option}
                        checked={asString(currentValue) === option}
                        onChange={(event) => onChange(field.key, event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        if (field.type === "checkbox") {
          return (
            <div key={field.key} className="flex items-center gap-2 rounded-md border border-brand-mist bg-white px-3 py-2">
              <input
                id={fieldId}
                type="checkbox"
                checked={Boolean(currentValue)}
                onChange={(event) => onChange(field.key, event.target.checked)}
              />
              <Label htmlFor={fieldId}>
                {field.label}
                {required}
              </Label>
            </div>
          );
        }

        return (
          <div key={field.key}>
            <Label htmlFor={fieldId}>
              {field.label}
              {required}
            </Label>
            <Input
              id={fieldId}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={asString(currentValue)}
              min={field.min}
              max={field.max}
              onChange={(event) => {
                if (field.type === "number") {
                  onChange(field.key, event.target.value === "" ? "" : Number(event.target.value));
                  return;
                }
                onChange(field.key, event.target.value);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
