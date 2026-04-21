"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingState } from "@/components/ui/loading-state";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [auth.status, pathname, router]);

  if (auth.status === "loading") {
    return <LoadingState label="Checking session..." />;
  }

  if (auth.status !== "authenticated") {
    return <LoadingState label="Redirecting to login..." />;
  }

  return <>{children}</>;
}
