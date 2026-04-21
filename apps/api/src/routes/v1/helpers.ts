import type { Request } from "express";
import { badRequest } from "../../errors/app-error";

export function param(req: Request, key: string): string {
  const value = req.params[key];
  if (!value) {
    badRequest(`Missing route parameter: ${key}`);
  }
  return Array.isArray(value) ? value[0] : value;
}

