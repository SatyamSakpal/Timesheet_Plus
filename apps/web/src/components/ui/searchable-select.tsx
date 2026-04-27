"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "@/lib/format";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Search...",
  disabled = false,
  noResultsText = "No matching options",
  className
}: {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  noResultsText?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label ?? "");
    }
  }, [isOpen, selectedOption?.label]);

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }
      if (rootRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  function openWithFreshQuery() {
    if (disabled) {
      return;
    }
    setIsOpen(true);
    setQuery("");
  }

  function closeAndRestoreSelection() {
    setIsOpen(false);
    setQuery(selectedOption?.label ?? "");
  }

  return (
    <div ref={rootRef} className={classNames("relative", className)}>
      <input
        id={id}
        type="text"
        value={isOpen ? query : selectedOption?.label ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={openWithFreshQuery}
        onChange={(event) => {
          if (!isOpen) {
            setIsOpen(true);
          }
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openWithFreshQuery();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            closeAndRestoreSelection();
            return;
          }
          if (event.key === "Enter" && isOpen && filteredOptions.length > 0) {
            event.preventDefault();
            const first = filteredOptions[0];
            onChange(first.value);
            setIsOpen(false);
            setQuery(first.label);
          }
        }}
        className={classNames(
          "w-full rounded-md border border-brand-mist bg-white px-3 py-2 pr-10 text-sm text-brand-slate outline-none transition focus:border-brand-moss focus:ring-2 focus:ring-brand-moss/20",
          disabled && "cursor-not-allowed bg-brand-mist/30 text-brand-moss"
        )}
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label={isOpen ? "Close options" : "Open options"}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (isOpen) {
            closeAndRestoreSelection();
            return;
          }
          openWithFreshQuery();
        }}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-brand-moss"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d={isOpen ? "m5 12 5-5 5 5" : "m5 8 5 5 5-5"} />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute z-[60] mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-brand-mist bg-white shadow-soft">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-brand-moss">{noResultsText}</p>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setQuery(option.label);
                    }}
                    className={classNames(
                      "block w-full px-3 py-2 text-left text-sm text-brand-slate hover:bg-brand-mist/40",
                      option.value === value && "bg-brand-mist/40 font-semibold"
                    )}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
