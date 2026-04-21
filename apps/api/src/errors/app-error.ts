export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): never {
  throw new AppError(message, 400, details);
}

export function unauthorized(message = "Unauthorized"): never {
  throw new AppError(message, 401);
}

export function forbidden(message = "Forbidden"): never {
  throw new AppError(message, 403);
}

export function notFound(message = "Not found"): never {
  throw new AppError(message, 404);
}

