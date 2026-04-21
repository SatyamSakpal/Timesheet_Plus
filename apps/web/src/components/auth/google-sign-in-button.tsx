"use client";

import { Button } from "@/components/ui/primitives";

export function GoogleSignInButton({
  onClick,
  disabled
}: {
  onClick: () => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full border border-brand-mist"
      disabled={disabled}
      onClick={() => {
        void onClick();
      }}
    >
      Sign in with Google
    </Button>
  );
}
