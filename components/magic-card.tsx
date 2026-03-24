"use client";

import { useMotionValue, useMotionTemplate, motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface MagicCardProps {
  title: string;
  description: string;
  className?: string;
  icon: LucideIcon;
}

export function MagicCard({
  title,
  description,
  icon: Icon,
  className,
}: MagicCardProps) {
  let mouseX = useMotionValue(-1000);
  let mouseY = useMotionValue(-1000);

  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent<HTMLDivElement>) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  function handleMouseLeave() {
    mouseX.set(-1000);
    mouseY.set(-1000);
  }

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card p-6 shadow-sm overflow-hidden",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 mix-blend-screen"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(124, 58, 237, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 mix-blend-overlay"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              600px circle at ${mouseX}px ${mouseY}px,
              rgba(6, 182, 212, 0.05),
              transparent 80%
            )
          `,
        }}
      />
      
      {/* Subtle border glow that follows mouse */}
      <motion.div
        className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-transparent opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              250px circle at ${mouseX}px ${mouseY}px,
              rgba(124, 58, 237, 0.5),
              transparent 80%
            ) border-box
          `,
          WebkitMask:
            "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "destination-out",
          maskComposite: "exclude",
        }}
      />

      <div className="relative z-10 flex h-full flex-col gap-4">
        {Icon && (
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 backdrop-blur-sm transition-colors duration-300 group-hover:bg-primary/20 group-hover:border-primary/40">
            <Icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
        <div className="mt-2 text-left">
          <h3 className="text-xl font-semibold mb-3 tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
