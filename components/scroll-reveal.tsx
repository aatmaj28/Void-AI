"use client"

import { motion, useInView } from "framer-motion"
import { useRef, ReactNode } from "react"

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  direction?: "up" | "down" | "left" | "right"
  duration?: number
  className?: string
}

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  duration = 0.6,
  className,
}: ScrollRevealProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  const initialVariant = {
    up: { opacity: 0, y: 24 },
    down: { opacity: 0, y: -24 },
    left: { opacity: 0, x: -24 },
    right: { opacity: 0, x: 24 },
  }

  const finalVariant = {
    opacity: 1,
    x: 0,
    y: 0,
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initialVariant[direction]}
      animate={isInView ? finalVariant : initialVariant[direction]}
      transition={{ duration, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}

interface ScrollRevealContainerProps {
  children: ReactNode | ((variants: any) => ReactNode)
  staggerDelay?: number
}

export function ScrollRevealContainer({
  children,
  staggerDelay = 0.1,
}: ScrollRevealContainerProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.15 })

  const containerVariant = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariant = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      variants={containerVariant}
    >
      {typeof children === "function" ? children(itemVariant) : children}
    </motion.div>
  )
}
