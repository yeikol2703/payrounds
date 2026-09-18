"use client";

import { useState } from "react";
import {
  DEFAULT_ICON_KEY,
  isDefaultIconKey,
  resolveServiceIconKey,
  simpleIconsCdnUrl,
} from "@/lib/service-icons";

type ServiceIconProps = {
  name: string;
  iconKey?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

const IMG = {
  sm: 18,
  md: 22,
  lg: 28,
} as const;

function DefaultGlyph({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-accent"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 15h4" />
    </svg>
  );
}

/**
 * Brand tile: Simple Icons CDN when known, otherwise default glyph.
 */
export function ServiceIcon({
  name,
  iconKey,
  size = "md",
  className = "",
}: ServiceIconProps) {
  const resolved = resolveServiceIconKey(iconKey, name);
  const [failed, setFailed] = useState(false);
  const showDefault = isDefaultIconKey(resolved) || failed;
  const px = IMG[size];

  // Reset load failure when the resolved brand changes.
  const [prevResolved, setPrevResolved] = useState(resolved);
  if (prevResolved !== resolved) {
    setPrevResolved(resolved);
    setFailed(false);
  }

  return (
    <div
      className={`pr-service-icon ${SIZE[size]} ${className}`}
      aria-hidden
      title={name}
    >
      {showDefault ? (
        <DefaultGlyph px={px} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- SVG CDN; next/image not needed
        <img
          src={simpleIconsCdnUrl(resolved)}
          alt=""
          width={px}
          height={px}
          className="h-[55%] w-[55%] object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export { DEFAULT_ICON_KEY };
