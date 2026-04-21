"use client";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center">
      <div className="animate-pulse text-sm text-brand-moss">{label}</div>
    </div>
  );
}
