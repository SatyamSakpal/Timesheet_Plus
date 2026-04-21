"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { AppQueryProvider } from "@/providers/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppQueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppQueryProvider>
  );
}
