"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button, Card, InlineError, Input, Label, SectionTitle } from "@/components/ui/primitives";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("owner@tenant.com");
  const [password, setPassword] = useState("Password@123");
  const [name, setName] = useState("owner");
  const [userId, setUserId] = useState("owner-1");
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAuth(action: () => Promise<void>) {
    try {
      setBusy(true);
      setError(null);
      await action();
      router.replace("/app");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.isMockAuth) {
      await runAuth(() =>
        auth.signInMock({
          id: userId.trim(),
          email: email.trim(),
          name: name.trim()
        })
      );
      return;
    }
    if (isSignup) {
      await runAuth(() => auth.signUpEmail(email.trim(), password));
      return;
    }
    await runAuth(() => auth.signInEmail(email.trim(), password));
  }

  return (
    <Card className="mx-auto max-w-md page-enter">
      <SectionTitle
        title="Sign In"
        subtitle={
          auth.isMockAuth
            ? "Mock auth mode is enabled. Credentials below are sent as x-user-* headers."
            : "Use email/password or Google to authenticate."
        }
      />

      <form className="space-y-3" onSubmit={onSubmit}>
        {auth.isMockAuth ? (
          <>
            <div>
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          </>
        ) : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {!auth.isMockAuth ? (
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        ) : null}

        <InlineError message={error} />

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Working..." : auth.isMockAuth ? "Continue in Mock Mode" : isSignup ? "Create Account" : "Sign In"}
        </Button>
      </form>

      {!auth.isMockAuth ? (
        <>
          <div className="my-3 text-center text-sm text-brand-moss">or</div>
          <GoogleSignInButton
            disabled={busy || !auth.isFirebaseReady}
            onClick={() => runAuth(() => auth.signInGoogle())}
          />
          <button
            type="button"
            className="mt-4 text-sm text-brand-moss underline"
            onClick={() => setIsSignup((value) => !value)}
          >
            {isSignup ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </>
      ) : null}
    </Card>
  );
}
