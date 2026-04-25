"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button, Card, InlineError, Input, Label, SectionTitle } from "@/components/ui/primitives";
import { useAuth } from "@/hooks/use-auth";

const RESEND_COOLDOWN_SECONDS = 20;

function toFriendlyAuthError(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? ((error as { code: string }).code)
      : "";
  const rawMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password"
  ) {
    return "Incorrect email or password. Please try again.";
  }
  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }
  if (code === "auth/email-already-in-use") {
    return "An account already exists with this email. Please sign in instead.";
  }
  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and try again.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Sign-in was cancelled before completion.";
  }
  if (code === "auth/popup-blocked") {
    return "Sign-in popup was blocked by your browser. Please allow popups and try again.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "This email is linked to another sign-in method. Use the original method for this account.";
  }
  if (code === "auth/user-disabled") {
    return "This account has been disabled. Contact support.";
  }

  if (rawMessage.includes("Firebase auth is not configured")) {
    return "Sign-in is currently unavailable. Please try again later.";
  }
  if (rawMessage.includes("not verified")) {
    return "Your email is not verified. Please verify your email before signing in.";
  }

  return rawMessage || fallback;
}

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("owner@tenant.com");
  const [password, setPassword] = useState("Password@123");
  const [signupName, setSignupName] = useState("");
  const [name, setName] = useState("owner");
  const [userId, setUserId] = useState("owner-1");
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldownSeconds]);

  async function runAuth(action: () => Promise<void>) {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await action();
      router.replace("/app");
    } catch (nextError) {
      setError(toFriendlyAuthError(nextError, "Authentication failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
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
      const normalizedName = signupName.trim();
      if (!normalizedName) {
        setError("Name is required.");
        return;
      }
      try {
        setBusy(true);
        setError(null);
        setNotice(null);
        await auth.signUpEmail(email.trim(), password, normalizedName);
        setVerificationSent(true);
        setResendCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        setNotice("Account created. Verification email sent. Verify your email before signing in.");
      } catch (nextError) {
        setError(toFriendlyAuthError(nextError, "Could not create account. Please try again."));
      } finally {
        setBusy(false);
      }
      return;
    }
    await runAuth(() => auth.signInEmail(email.trim(), password));
  }

  async function onResendVerification() {
    if (auth.isMockAuth || busy) {
      return;
    }
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required to resend verification.");
      return;
    }
    try {
      setBusy(true);
      await auth.resendEmailVerification(normalizedEmail, password);
      setVerificationSent(true);
      setResendCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setNotice("Verification email sent. Check inbox and spam folder.");
    } catch (nextError) {
      setError(toFriendlyAuthError(nextError, "Could not resend verification email. Please try again."));
    } finally {
      setBusy(false);
    }
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
              <Label htmlFor="user-id">Username</Label>
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
        {!auth.isMockAuth && isSignup ? (
          <div>
            <Label htmlFor="signup-name">Name</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={signupName}
              onChange={(event) => setSignupName(event.target.value)}
              required
            />
          </div>
        ) : null}
        {!auth.isMockAuth ? (
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="flex items-center gap-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 px-3"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
        ) : null}

        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        <InlineError message={error} />

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Working..." : auth.isMockAuth ? "Continue in Mock Mode" : isSignup ? "Create Account" : "Sign In"}
        </Button>
        {!auth.isMockAuth && isSignup && verificationSent ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy || resendCooldownSeconds > 0}
            onClick={onResendVerification}
          >
            {resendCooldownSeconds > 0 ? `Resend Verification Email (${resendCooldownSeconds}s)` : "Resend Verification Email"}
          </Button>
        ) : null}
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
            onClick={() => {
              setIsSignup((value) => !value);
              setError(null);
              setNotice(null);
              setVerificationSent(false);
              setResendCooldownSeconds(0);
            }}
          >
            {isSignup ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </>
      ) : null}
    </Card>
  );
}
