import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { getFirebaseAuth } from "../config/firebase";
import { unauthorized } from "../errors/app-error";

function parseBearerToken(header?: string): string {
  if (!header || !header.startsWith("Bearer ")) {
    unauthorized("Missing Bearer token");
  }
  return header.slice("Bearer ".length).trim();
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    // Local tests/emulator can bypass Firebase by sending deterministic headers.
    if (env.MOCK_AUTH_ENABLED) {
      const mockUid = req.header("x-user-id");
      const mockEmail = req.header("x-user-email");
      const mockName = req.header("x-user-name");
      if (mockUid && mockEmail) {
        req.user = {
          uid: mockUid,
          email: mockEmail,
          name: mockName ?? mockEmail.split("@")[0]
        };
        return next();
      }
    }

    // Production path: validate Firebase ID token and map to request user.
    const token = parseBearerToken(req.header("authorization"));
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? "unknown@example.com",
      name: decoded.name ?? decoded.email?.split("@")[0] ?? decoded.uid
    };
    return next();
  } catch {
    return next(unauthorized("Invalid authentication token"));
  }
}
