"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { classNames } from "@/lib/format";

interface ModalOverlayProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function ModalOverlay({ children, onClose, className }: ModalOverlayProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className={classNames(
        "fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/55 p-4",
        className
      )}
      onClick={onClose}
    >
      {children}
    </div>,
    document.body
  );
}
