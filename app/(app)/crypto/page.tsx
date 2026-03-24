"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"

function FloatingOrb({
  className,
  delay = 0,
  duration = 8,
}: {
  className?: string
  delay?: number
  duration?: number
}) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -28, 0],
        x: [0, 12, 0],
        scale: [1, 1.08, 1],
        opacity: [0.35, 0.6, 0.35],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

function SparkLine() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-40"
      preserveAspectRatio="none"
      viewBox="0 0 400 120"
    >
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="50%" stopColor="var(--cyan)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,90 Q50,20 100,60 T200,40 T300,70 T400,30"
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
      <motion.path
        d="M0,95 Q80,50 160,75 T320,45 T400,85"
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, delay: 0.4, ease: "easeInOut" }}
      />
    </svg>
  )
}

export default function CryptoComingSoonPage() {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Ambient grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <FloatingOrb
        className="pointer-events-none absolute -top-20 left-[10%] h-72 w-72 rounded-full bg-primary/25 blur-[100px]"
        delay={0}
        duration={9}
      />
      <FloatingOrb
        className="pointer-events-none absolute bottom-0 right-[5%] h-96 w-96 rounded-full bg-cyan/20 blur-[110px]"
        delay={1.2}
        duration={11}
      />
      <FloatingOrb
        className="pointer-events-none absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-primary/15 blur-[80px]"
        delay={2}
        duration={7}
      />

      <div className="relative z-10 w-full max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/10">
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-cyan/20"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              style={{ opacity: 0.5 }}
            />
            <Coins className="relative h-10 w-10 text-primary" />
          </div>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground via-primary to-cyan bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          Crypto
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl font-semibold text-muted-foreground mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
        >
          <span className="inline-block">
            {"Coming Soon".split("").map((char, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.04, duration: 0.25 }}
              >
                {char === " " ? "\u00a0" : char}
              </motion.span>
            ))}
          </span>
          <motion.span
            className="inline-block ml-0.5"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            !!
          </motion.span>
        </motion.p>

        <motion.p
          className="text-sm text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          On-chain metrics, token screens, and portfolio hooks are on the roadmap and being styled for Void.AI
        </motion.p>

        {/* Chart decoration */}
        <motion.div
          className="relative h-28 w-full max-w-md mx-auto mb-10 rounded-xl border border-border/60 bg-card/40 overflow-hidden"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <SparkLine />
          <div className="absolute bottom-2 left-3 right-3 flex justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <span>Void</span>
            <span className="text-primary">α</span>
            <span>Chain</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <Button variant="outline" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to markets
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Scrolling ticker feel */}
      <div className="pointer-events-none absolute bottom-8 left-0 right-0 overflow-hidden h-8 opacity-30">
        <motion.div
          className="flex gap-12 text-xs font-mono text-muted-foreground whitespace-nowrap"
          animate={{ x: [0, -600] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i}>
              BTC · ETH · SOL · VOID · CYAN · PRIMARY · ALPHA ·
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
