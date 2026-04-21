import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { env } from "./env";

function hasFirebaseConfig() {
  return Object.values(env.firebase).every((value) => value.length > 0);
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return hasFirebaseConfig();
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig()) {
    return null;
  }
  if (cachedApp) {
    return cachedApp;
  }
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(env.firebase);
  return cachedApp;
}

export function getFirebaseAuthInstance(): Auth | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  if (cachedAuth) {
    return cachedAuth;
  }
  cachedAuth = getAuth(app);
  return cachedAuth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}
