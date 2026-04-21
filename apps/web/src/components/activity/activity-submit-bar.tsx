"use client";

import { Button } from "@/components/ui/primitives";

export function ActivitySubmitBar({
  disabled,
  isPending,
  onSaveDraft,
  onSubmit
}: {
  disabled?: boolean;
  isPending?: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="ghost" disabled={disabled || isPending} onClick={onSaveDraft}>
        Save Draft
      </Button>
      <Button type="button" disabled={disabled || isPending} onClick={onSubmit}>
        {isPending ? "Submitting..." : "Submit Activity"}
      </Button>
    </div>
  );
}
