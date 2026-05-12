"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Payround app error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-muted">
        Try again. If this keeps happening, run{" "}
        <code className="rounded bg-elevated-muted px-1.5 py-0.5 text-xs">
          npm run dev
        </code>{" "}
        to see the full error (production hides details).
      </p>
      {isDev ? (
        <pre className="max-h-48 max-w-lg overflow-auto rounded-lg border border-border bg-elevated-muted p-3 text-left text-xs text-foreground">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      ) : error.digest ? (
        <p className="text-xs text-subtle">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        Try again
      </button>
    </div>
  );
}
