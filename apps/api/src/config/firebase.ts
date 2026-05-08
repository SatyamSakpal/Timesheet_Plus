import admin from "firebase-admin";
import { env } from "./env";

let initialized = false;

function parseServiceAccountFromEnv(): admin.ServiceAccount | null {
  const rawJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as admin.ServiceAccount;
      if (parsed.privateKey) {
        parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${(error as Error).message}`
      );
    }
  }

  const base64Json = env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64Json) {
    try {
      const decoded = Buffer.from(base64Json, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as admin.ServiceAccount;
      if (parsed.privateKey) {
        parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `Invalid FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: ${(error as Error).message}`
      );
    }
  }

  return null;
}

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const options: admin.AppOptions = {};
  if (env.FIREBASE_PROJECT_ID) {
    options.projectId = env.FIREBASE_PROJECT_ID;
  }

  const serviceAccount = parseServiceAccountFromEnv();
  if (serviceAccount) {
    options.credential = admin.credential.cert(serviceAccount);
  }

  const hasCredentialSource =
    Boolean(options.credential) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (env.DATA_PROVIDER === "firestore" && !hasCredentialSource) {
    throw new Error(
      "Firestore is enabled but no Google credentials were found. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 " +
        "(recommended for hosting), or set GOOGLE_APPLICATION_CREDENTIALS to a valid file path."
    );
  }

  admin.initializeApp(options);
  initialized = true;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!initialized) {
    initFirebase();
  }
  return admin.auth();
}

export function getFirestore(): admin.firestore.Firestore {
  if (!initialized) {
    initFirebase();
  }
  return admin.firestore();
}
