import admin from "firebase-admin";
import { env } from "./env";

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const options: admin.AppOptions = {};
  if (env.FIREBASE_PROJECT_ID) {
    options.projectId = env.FIREBASE_PROJECT_ID;
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

