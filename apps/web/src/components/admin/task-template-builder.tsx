"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { FieldCatalogItem, TaskFieldSchema, TaskTemplate } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

interface EditableField extends TaskFieldSchema {
  id: string;
}

function createBlankField(): EditableField {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    type: "text",
    required: false
  };
}

export function TaskTemplateBuilder({
  tenantId,
  onCreated
}: {
  tenantId: string;
  onCreated?: (taskTemplate: TaskTemplate) => void;
}) {
  const apiClient = useApiClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<EditableField[]>([createBlankField()]);
  const [error, setError] = useState<string | null>(null);

  const fieldCatalogQuery = useQuery({
    queryKey: queryKeys.fieldsCatalog,
    queryFn: () => apiClient.get<FieldCatalogItem[]>("/v1/catalog/fields")
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; fields: TaskFieldSchema[] }) =>
      apiClient.post<TaskTemplate>(`/v1/tenants/${tenantId}/task-templates`, { body: payload }),
    onSuccess: (template) => {
      setName("");
      setDescription("");
      setFields([createBlankField()]);
      setError(null);
      onCreated?.(template);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create task template.");
    }
  });

  const fieldTypes = useMemo(
    () => fieldCatalogQuery.data?.map((fieldCatalog) => fieldCatalog.key) ?? ["text", "number", "date", "select", "checkbox", "textarea"],
    [fieldCatalogQuery.data]
  );

  function updateField(fieldId: string, patch: Partial<EditableField>) {
    setFields((state) => state.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  }

  function removeField(fieldId: string) {
    setFields((state) => state.filter((field) => field.id !== fieldId));
  }

  function addField() {
    setFields((state) => [...state, createBlankField()]);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    const parsedFields: TaskFieldSchema[] = [];
    for (const field of fields) {
      if (!field.key.trim() || !field.label.trim()) {
        setError("Each field requires key and label.");
        return;
      }
      if (field.type === "select" && (!field.options || field.options.length === 0)) {
        setError(`Field "${field.label}" needs at least one option.`);
        return;
      }
      parsedFields.push({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.options,
        min: field.min,
        max: field.max
      });
    }
    if (parsedFields.length === 0) {
      setError("Add at least one field.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      fields: parsedFields
    });
  }

  return (
    <Card>
      <SectionTitle title="Task Template Builder" subtitle="Build schema fields from field catalog." />
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="task-template-name">Template Name</Label>
            <Input
              id="task-template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="task-template-description">Description</Label>
            <Input
              id="task-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border border-brand-mist/60 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-moss">
                Field {index + 1}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Key</Label>
                  <Input
                    value={field.key}
                    onChange={(event) => updateField(field.id, { key: event.target.value })}
                    placeholder="hours"
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={field.label}
                    onChange={(event) => updateField(field.id, { label: event.target.value })}
                    placeholder="Hours"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={field.type}
                    onChange={(event) =>
                      updateField(field.id, {
                        type: event.target.value as TaskFieldSchema["type"],
                        options:
                          event.target.value === "select"
                            ? field.options ?? []
                            : undefined
                      })
                    }
                  >
                    {fieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-brand-slate">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateField(field.id, { required: event.target.checked })}
                    />
                    Required
                  </label>
                </div>
                {field.type === "select" ? (
                  <div className="md:col-span-2">
                    <Label>Options (comma separated)</Label>
                    <Input
                      value={(field.options ?? []).join(", ")}
                      onChange={(event) =>
                        updateField(field.id, {
                          options: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </div>
                ) : null}
                {field.type === "number" ? (
                  <>
                    <div>
                      <Label>Min</Label>
                      <Input
                        type="number"
                        value={field.min ?? ""}
                        onChange={(event) =>
                          updateField(field.id, {
                            min: event.target.value === "" ? undefined : Number(event.target.value)
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Max</Label>
                      <Input
                        type="number"
                        value={field.max ?? ""}
                        onChange={(event) =>
                          updateField(field.id, {
                            max: event.target.value === "" ? undefined : Number(event.target.value)
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-red-700 underline"
                onClick={() => removeField(field.id)}
                disabled={fields.length <= 1}
              >
                Remove field
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={addField}>
            Add Field
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
        <InlineError message={error} />
      </form>
    </Card>
  );
}
