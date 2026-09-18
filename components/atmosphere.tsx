"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "framer-motion";

type Star = {
  id: number;
  left: number;
  top: number;
  size: number;
  dur: number;
  delay: number;
};

/** Soft twinkling stars — Asteria / celestial ambient. */
export function StarField({ count = 72 }: { count?: number }) {
  const reduce = useReducedMotion();
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: (i * 37 + 11) % 100,
      top: (i * 53 + 7) % 100,
      size: i % 5 === 0 ? 3.2 : i % 3 === 0 ? 2.2 : 1.2 + (i % 3) * 0.45,
      dur: 2.8 + (i % 6) * 0.75,
      delay: -(i * 0.31),
    }));
  }, [count]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {stars.map((s) => (
        <span
          key={s.id}
          className="pr-star"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              ["--dur" as string]: reduce ? "0s" : `${s.dur}s`,
              ["--delay" as string]: `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** @deprecated Use {@link StarField}. */
export const BubbleField = StarField;

function isPointerFine(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(pointer: fine)").matches;
}

/**
 * Celestial backdrop with mouse spotlight + star parallax.
 */
export function Atmosphere() {
  const reduce = useReducedMotion();
  const glowRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const targetRef = useRef({ x: 0.5, y: 0.5 });
  const currentRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (reduce || !isPointerFine()) {
      return;
    }

    const root = document.documentElement;

    function onMove(event: PointerEvent) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      targetRef.current = {
        x: event.clientX / w,
        y: event.clientY / h,
      };
    }

    function tick() {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.09;
      cur.y += (tgt.y - cur.y) * 0.09;

      const mx = `${(cur.x * 100).toFixed(2)}%`;
      const my = `${(cur.y * 100).toFixed(2)}%`;

      root.style.setProperty("--pr-mx", mx);
      root.style.setProperty("--pr-my", my);

      if (glowRef.current) {
        glowRef.current.style.setProperty("--mx", mx);
        glowRef.current.style.setProperty("--my", my);
      }

      if (parallaxRef.current) {
        const px = ((cur.x - 0.5) * 28).toFixed(2);
        const py = ((cur.y - 0.5) * 20).toFixed(2);
        parallaxRef.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(rafRef.current);
      root.style.removeProperty("--pr-mx");
      root.style.removeProperty("--pr-my");
    };
  }, [reduce]);

  return (
    <div className="pr-atmosphere" aria-hidden>
      <div className="pr-atmosphere-mesh" />
      <div ref={glowRef} className="pr-pointer-glow" />
      <div ref={parallaxRef} className="pr-starfield-parallax">
        <StarField />
      </div>
    </div>
  );
}
