"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { queryKeys } from "@/lib/query-keys";
import type { FieldCatalogItem, TaskFieldSchema, TaskTemplate } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle, Select } from "@/components/ui/primitives";

interface EditableField extends TaskFieldSchema {
  id: string;
  optionsText: string;
}

function createEditableField(field?: TaskFieldSchema): EditableField {
  const options = field?.options ?? [];
  return {
    id: crypto.randomUUID(),
    key: field?.key ?? "",
    label: field?.label ?? "",
    type: field?.type ?? "text",
    required: field?.required ?? false,
    options,
    optionsText: options.join(", "),
    min: field?.min,
    max: field?.max
  };
}

function createBlankField(): EditableField {
  return createEditableField();
}

export function TaskTemplateBuilder({
  tenantId,
  template,
  canManage,
  onSaved,
  onCancelEdit
}: {
  tenantId: string;
  template: TaskTemplate | null;
  canManage: boolean;
  onSaved?: (taskTemplate: TaskTemplate) => void;
  onCancelEdit?: () => void;
}) {
  const apiClient = useApiClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<EditableField[]>([createBlankField()]);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(template);

  useEffect(() => {
    if (!template) {
      setName("");
      setDescription("");
      setIsActive(true);
      setFields([createBlankField()]);
      setError(null);
      return;
    }
    setName(template.name);
    setDescription(template.description ?? "");
    setIsActive(template.isActive);
    setFields(template.fields.map((field) => createEditableField(field)));
    setError(null);
  }, [template]);

  const fieldCatalogQuery = useQuery({
    queryKey: queryKeys.fieldsCatalog,
    queryFn: () => apiClient.get<FieldCatalogItem[]>("/v1/catalog/fields")
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; fields: TaskFieldSchema[] }) =>
      apiClient.post<TaskTemplate>(`/v1/tenants/${tenantId}/task-templates`, { body: payload }),
    onSuccess: (nextTemplate) => {
      setError(null);
      onSaved?.(nextTemplate);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create activity template.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      taskTemplateId: string;
      name: string;
      description?: string;
      fields: TaskFieldSchema[];
      isActive: boolean;
    }) =>
      apiClient.patch<TaskTemplate>(`/v1/tenants/${tenantId}/task-templates/${payload.taskTemplateId}`, {
        body: {
          name: payload.name,
          description: payload.description,
          fields: payload.fields,
          isActive: payload.isActive
        }
      }),
    onSuccess: (nextTemplate) => {
      setError(null);
      onSaved?.(nextTemplate);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to update activity template.");
    }
  });

  const fieldTypes = useMemo(
    () =>
      fieldCatalogQuery.data?.map((fieldCatalog) => fieldCatalog.key) ?? [
        "text",
        "number",
        "date",
        "select",
        "radio",
        "checkbox",
        "textarea"
      ],
    [fieldCatalogQuery.data]
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isReadOnly = isPending || !canManage;

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
    if (!canManage) {
      setError("You do not have permission to manage activity templates.");
      return;
    }
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
      const parsedOptions =
        field.type === "select" || field.type === "radio"
          ? (field.optionsText ?? "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined;
      if ((field.type === "select" || field.type === "radio") && (!parsedOptions || parsedOptions.length === 0)) {
        setError(`Field "${field.label}" needs at least one option.`);
        return;
      }
      parsedFields.push({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: parsedOptions,
        min: field.min,
        max: field.max
      });
    }
    if (parsedFields.length === 0) {
      setError("Add at least one field.");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      fields: parsedFields
    };

    if (template) {
      updateMutation.mutate({
        taskTemplateId: template.id,
        ...payload,
        isActive
      });
      return;
    }
    createMutation.mutate(payload);
  }

  return (
    <Card>
      <SectionTitle
        title={isEditing ? "Edit Activity Template" : "Create Activity Template"}
        subtitle="Build and maintain the form fields used when activities are logged."
      />
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="task-template-name">Template Name</Label>
            <Input
              id="task-template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>
          <div>
            <Label htmlFor="task-template-description">Description</Label>
            <Input
              id="task-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {isEditing ? (
          <label className="inline-flex items-center gap-2 text-sm text-brand-slate">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isReadOnly}
            />
            Template Active
          </label>
        ) : null}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border border-brand-mist/60 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-moss">Field {index + 1}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Key</Label>
                  <Input
                    value={field.key}
                    onChange={(event) => updateField(field.id, { key: event.target.value })}
                    placeholder="hours"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={field.label}
                    onChange={(event) => updateField(field.id, { label: event.target.value })}
                    placeholder="Hours"
                    disabled={isReadOnly}
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
                          event.target.value === "select" || event.target.value === "radio"
                            ? field.options ?? []
                            : undefined,
                        optionsText:
                          event.target.value === "select" || event.target.value === "radio"
                            ? field.optionsText ?? ""
                            : ""
                      })
                    }
                    disabled={isReadOnly}
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
                      disabled={isReadOnly}
                    />
                    Required
                  </label>
                </div>
                {field.type === "select" || field.type === "radio" ? (
                  <div className="md:col-span-2">
                    <Label>Options (comma separated)</Label>
                    <Input
                      value={field.optionsText}
                      onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                      disabled={isReadOnly}
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
                        disabled={isReadOnly}
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
                        disabled={isReadOnly}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-red-700 underline"
                onClick={() => removeField(field.id)}
                disabled={fields.length <= 1 || isReadOnly}
              >
                Remove field
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={addField} disabled={isReadOnly}>
            Add Field
          </Button>
          <Button type="submit" disabled={isReadOnly}>
            {isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Template"
                : "Create Template"}
          </Button>
          {isEditing && onCancelEdit ? (
            <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={isReadOnly}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
        {!canManage ? (
          <p className="text-sm text-brand-moss">You do not have permission to create or edit activity templates.</p>
        ) : null}
        <InlineError message={error} />
      </form>
    </Card>
  );
}
