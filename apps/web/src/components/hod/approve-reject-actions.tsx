"use client";

import { useState } from "react";
import { Button, InlineError, Input, Label } from "@/components/ui/primitives";

export function ApproveRejectActions({
  disabled,
  onApprove,
  onReject
}: {
  disabled?: boolean;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);

  async function handleApprove() {
    try {
      setError(null);
      setBusyAction("approve");
      await onApprove();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Approve failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Reject reason must be at least 3 characters.");
      return;
    }
    try {
      setError(null);
      setBusyAction("reject");
      await onReject(trimmed);
      setReason("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Reject failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button disabled={disabled || busyAction !== null} onClick={() => void handleApprove()}>
          {busyAction === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button
          variant="danger"
          disabled={disabled || busyAction !== null}
          onClick={() => void handleReject()}
        >
          {busyAction === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      <div>
        <Label htmlFor="reject-reason">Reject Reason</Label>
        <Input
          id="reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason shown to contributor"
          disabled={disabled || busyAction !== null}
        />
      </div>
      <InlineError message={error} />
    </div>
  );
}
