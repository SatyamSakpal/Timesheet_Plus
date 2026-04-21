"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";
import { getFirebaseAuthInstance, isFirebaseConfigured } from "@/lib/firebase";
import type { AuthUserSnapshot } from "@/lib/types";

const MOCK_USER_KEY = "timesheetplus.mock-user";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUserSnapshot | null;
  isMockAuth: boolean;
  isFirebaseReady: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInMock: (user: AuthUserSnapshot) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toName(email?: string | null, fallbackId?: string): string {
  if (!email) {
    return fallbackId ?? "User";
  }
  return email.split("@")[0] || email;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserSnapshot | null>(null);

  const isMockAuth = env.mockAuthEnabled;
  const isFirebaseReady = isFirebaseConfigured() && !isMockAuth;

  useEffect(() => {
    if (isMockAuth) {
      const raw = window.localStorage.getItem(MOCK_USER_KEY);
      if (!raw) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      try {
        const parsed = JSON.parse(raw) as AuthUserSnapshot;
        if (parsed.id && parsed.email && parsed.name) {
          setUser(parsed);
          setStatus("authenticated");
          return;
        }
      } catch {
        // Ignore malformed persisted values.
      }
      window.localStorage.removeItem(MOCK_USER_KEY);
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    const auth = getFirebaseAuthInstance();
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email ?? "unknown@example.com",
        name: firebaseUser.displayName ?? toName(firebaseUser.email, firebaseUser.uid)
      });
      setStatus("authenticated");
    });

    return unsubscribe;
  }, [isMockAuth]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    if (isMockAuth) {
      throw new Error("Email login is disabled while mock auth is enabled.");
    }
    const auth = getFirebaseAuthInstance();
    if (!auth) {
      throw new Error("Firebase auth is not configured.");
    }
    await signInWithEmailAndPassword(auth, email, password);
  }, [isMockAuth]);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    if (isMockAuth) {
      throw new Error("Email signup is disabled while mock auth is enabled.");
    }
    const auth = getFirebaseAuthInstance();
    if (!auth) {
      throw new Error("Firebase auth is not configured.");
    }
    await createUserWithEmailAndPassword(auth, email, password);
  }, [isMockAuth]);

  const signInGoogle = useCallback(async () => {
    if (isMockAuth) {
      throw new Error("Google login is disabled while mock auth is enabled.");
    }
    const auth = getFirebaseAuthInstance();
    if (!auth) {
      throw new Error("Firebase auth is not configured.");
    }
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, [isMockAuth]);

  const signInMock = useCallback(async (snapshot: AuthUserSnapshot) => {
    window.localStorage.setItem(MOCK_USER_KEY, JSON.stringify(snapshot));
    setUser(snapshot);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    if (isMockAuth) {
      window.localStorage.removeItem(MOCK_USER_KEY);
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    const auth = getFirebaseAuthInstance();
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    await firebaseSignOut(auth);
  }, [isMockAuth]);

  const getAccessToken = useCallback(async () => {
    if (isMockAuth) {
      return null;
    }
    const auth = getFirebaseAuthInstance();
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      return null;
    }
    return currentUser.getIdToken();
  }, [isMockAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isMockAuth,
      isFirebaseReady,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signInMock,
      signOut,
      getAccessToken
    }),
    [
      getAccessToken,
      isFirebaseReady,
      isMockAuth,
      signInEmail,
      signInGoogle,
      signInMock,
      signOut,
      signUpEmail,
      status,
      user
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider.");
  }
  return context;
}
