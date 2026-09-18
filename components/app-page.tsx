"use client";

import type { ReactNode } from "react";
import { MotionPage } from "@/components/motion";

const WIDTH = {
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  full: "max-w-none",
} as const;

export type AppPageWidth = keyof typeof WIDTH;

const OUTER =
  "px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-0 md:px-8 md:py-8";

const HEADER =
  "mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between";

/**
 * Canonical page chrome (notifications / panel pattern):
 * full-bleed padded shell → header band → left-aligned content column.
 */
export function AppPage({
  title,
  lead,
  actions,
  children,
  width = "lg",
  beforeHeader,
  motion = false,
  className,
  contentClassName,
  "data-testid": testId,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: AppPageWidth;
  /** Back link or breadcrumbs above the title row */
  beforeHeader?: ReactNode;
  motion?: boolean;
  className?: string;
  contentClassName?: string;
  "data-testid"?: string;
}) {
  const body = (
    <>
      {beforeHeader}
      <div className={HEADER}>
        <div className="min-w-0 text-left">
          {typeof title === "string" || typeof title === "number" ? (
            <h1 className="pr-page-title">{title}</h1>
          ) : (
            title
          )}
          {lead != null && lead !== false ? (
            typeof lead === "string" || typeof lead === "number" ? (
              <p className="pr-section-lead">{lead}</p>
            ) : (
              lead
            )
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {actions}
          </div>
        ) : null}
      </div>
      <div
        className={`w-full text-left ${WIDTH[width]}${
          contentClassName ? ` ${contentClassName}` : ""
        }`}
      >
        {children}
      </div>
    </>
  );

  const outerClass = className ? `${OUTER} ${className}` : OUTER;

  if (motion) {
    return (
      <MotionPage className={outerClass} data-testid={testId}>
        {body}
      </MotionPage>
    );
  }

  return (
    <div className={outerClass} data-testid={testId}>
      {body}
    </div>
  );
}
