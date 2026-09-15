"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  text: string;
  className?: string;
  /** Optional test id for Playwright. */
  "data-testid"?: string;
};

export function CopyLinkButton({
  text,
  className,
  "data-testid": testId,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => void handleCopy()}
      aria-live="polite"
      className={
        className ??
        "shrink-0 rounded-xl border border-border bg-elevated px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-elevated-muted"
      }
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
