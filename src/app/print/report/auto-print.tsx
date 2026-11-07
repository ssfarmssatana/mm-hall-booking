"use client";

import { useEffect } from "react";

/** Opens the print dialog once charts have rendered (used by the "PDF report" button). */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}
