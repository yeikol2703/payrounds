"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;
const springSoft = { type: "spring" as const, stiffness: 380, damping: 32 };

export function MotionPage({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: easeOut }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionList({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: reduce
            ? { staggerChildren: 0 }
            : { staggerChildren: 0.06 },
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 12, scale: 0.98 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.35, ease: easeOut },
        },
      }}
      whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.2 } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Route-level fade for shell main content. */
export function RouteFade({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        className="min-h-full"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { motion, useReducedMotion, AnimatePresence, springSoft };
