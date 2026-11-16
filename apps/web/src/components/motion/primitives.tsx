"use client";

import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Global motion configuration honoring OS prefers-reduced-motion. */
export function DriveCoreMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Subtle entrance animation for view switches and featured panels. */
export function ViewFadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT, delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
