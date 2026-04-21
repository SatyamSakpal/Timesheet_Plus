import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("Route not found", 404));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (process.env.NODE_ENV !== "test") {
    const normalized = err instanceof Error ? err : new Error(String(err));
    console.error("[api] Request error", {
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.uid ?? null,
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: err.flatten()
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details ?? null
      }
    });
  }

  return res.status(500).json({
    error: {
      message: "Internal server error"
    }
  });
}
