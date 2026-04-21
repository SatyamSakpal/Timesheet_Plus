import type { NextFunction, Request, Response } from "express";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch((error) => {
      if (process.env.NODE_ENV !== "test") {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("[api] Async route failure", {
          method: req.method,
          path: req.originalUrl,
          message: err.message,
          stack: err.stack
        });
      }
      next(error);
    });
  };
}
