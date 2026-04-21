import { badRequest } from "../errors/app-error";
import type { TaskFieldSchema } from "../types/domain";

function isIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.includes("T");
}

export function validateTaskPayload(
  fields: TaskFieldSchema[],
  payload: Record<string, unknown>,
  strictRequired: boolean
): void {
  // Reject unknown keys to avoid silent storage of arbitrary client data.
  const fieldKeys = new Set(fields.map((field) => field.key));
  for (const payloadKey of Object.keys(payload)) {
    if (!fieldKeys.has(payloadKey)) {
      badRequest(`Unexpected field "${payloadKey}" in payload`);
    }
  }

  for (const field of fields) {
    const value = payload[field.key];
    const missing = value === undefined || value === null || value === "";
    if (field.required && strictRequired && missing) {
      badRequest(`Field "${field.key}" is required`);
    }
    if (missing) {
      continue;
    }

    // Type-specific validation keeps task schemas authoritative at runtime.
    switch (field.type) {
      case "text":
      case "textarea": {
        if (typeof value !== "string") {
          badRequest(`Field "${field.key}" must be a string`);
        }
        break;
      }
      case "number": {
        if (typeof value !== "number" || Number.isNaN(value)) {
          badRequest(`Field "${field.key}" must be a number`);
        }
        if (field.min !== undefined && value < field.min) {
          badRequest(`Field "${field.key}" must be >= ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          badRequest(`Field "${field.key}" must be <= ${field.max}`);
        }
        break;
      }
      case "date": {
        if (typeof value !== "string" || !isIsoDate(value)) {
          badRequest(`Field "${field.key}" must be an ISO date string`);
        }
        break;
      }
      case "select": {
        if (typeof value !== "string") {
          badRequest(`Field "${field.key}" must be a string option`);
        }
        if (field.options && !field.options.includes(value)) {
          badRequest(`Field "${field.key}" has invalid option`);
        }
        break;
      }
      case "checkbox": {
        if (typeof value !== "boolean") {
          badRequest(`Field "${field.key}" must be a boolean`);
        }
        break;
      }
      default: {
        badRequest(`Unsupported field type ${(field as { type: string }).type}`);
      }
    }
  }
}
