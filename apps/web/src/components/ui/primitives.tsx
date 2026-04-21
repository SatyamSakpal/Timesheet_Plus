"use client";

import { forwardRef } from "react";
import { classNames } from "@/lib/format";

interface SharedProps {
  className?: string;
}

export function Card({
  className,
  children
}: SharedProps & {
  children: React.ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded-lg border border-brand-mist/90 bg-white p-5 shadow-soft",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2
        className="text-xl font-semibold text-brand-slate"
        style={{ fontFamily: "var(--font-heading), sans-serif" }}
      >
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-brand-moss">{subtitle}</p> : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & SharedProps
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={classNames(
        "w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & SharedProps
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={classNames(
        "w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20",
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & SharedProps
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={classNames(
        "w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  children,
  htmlFor
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-moss">
      {children}
    </label>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-brand-moss text-white hover:bg-brand-pine"
      : variant === "secondary"
        ? "bg-brand-clay text-white hover:bg-brand-moss"
        : variant === "danger"
          ? "bg-[#9d2e2e] text-white hover:bg-[#7d1f1f]"
          : "bg-transparent text-brand-slate hover:bg-brand-mist/50";
  return (
    <button
      className={classNames(
        "rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClass,
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  value,
  tone = "neutral"
}: {
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800"
        : tone === "danger"
          ? "bg-red-100 text-red-800"
          : tone === "info"
            ? "bg-sky-100 text-sky-800"
            : "bg-stone-200 text-stone-800";

  return (
    <span className={classNames("rounded-full px-2 py-1 text-xs font-semibold", toneClass)}>
      {value}
    </span>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return <p className="mt-2 text-sm text-red-700">{message}</p>;
}
