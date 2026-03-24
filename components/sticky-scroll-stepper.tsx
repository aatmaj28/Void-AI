"use client"

import React, { useRef, useState } from "react"
import { motion, useScroll, useMotionValueEvent } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  title: string
  description: string
  icon: LucideIcon
}

interface StickyScrollStepperProps {
  steps: Step[]
}

const stepColors = [
  "from-blue-500/20 to-cyan-500/20",
  "from-purple-500/20 to-pink-500/20",
  "from-amber-500/20 to-orange-500/20",
  "from-emerald-500/20 to-teal-500/20",
]

const iconColors = [
  "text-blue-500",
  "text-purple-500",
  "text-amber-500",
  "text-emerald-500",
]

export function StickyScrollStepper({ steps }: StickyScrollStepperProps) {
  const [activeCard, setActiveCard] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end center"],
  })

  const cardsLength = steps.length

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const cardsBreakpoints = steps.map((_, index) => index / cardsLength)
    const closestBreakpointIndex = cardsBreakpoints.reduce(
      (acc, breakpoint, index) => {
        const distance = Math.abs(latest - breakpoint)
        if (distance < Math.abs(latest - cardsBreakpoints[acc])) {
          return index
        }
        return acc
      },
      0
    )
    setActiveCard(closestBreakpointIndex)
  })

  const activeSection = steps[activeCard]
  const ActiveIcon = activeSection.icon
  const activeColor = stepColors[activeCard % stepColors.length]
  const activeIconColor = iconColors[activeCard % iconColors.length]

  return (
    <div className="relative flex justify-center w-full max-w-6xl mx-auto md:px-10 mt-4 md:mt-8" ref={ref}>
      {/* Left side: Scrolling Content */}
      <div className="w-full md:w-1/2 flex flex-col relative px-4">
        {steps.map((item, index) => (
          <div key={item.title} className="py-10 md:py-16 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: activeCard === index ? 1 : 0.3, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={cn("p-4 rounded-xl bg-card border shadow-lg flex items-center justify-center transition-colors duration-500", activeCard === index ? "border-primary/50" : "")}>
                  <item.icon className={cn("h-8 w-8 transition-colors duration-500", activeCard === index ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">0{index + 1}</div>
                  <h3 className="text-2xl md:text-3xl font-bold">{item.title}</h3>
                </div>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          </div>
        ))}
        {/* Extra spacing to allow full scrolling */}
        <div className="h-40" />
      </div>

      {/* Right side: Sticky Visuals */}
      <div className="hidden md:flex flex-col justify-start sticky top-32 h-fit w-1/2 ml-auto">
        <div className="w-full aspect-square max-h-[500px] bg-card/50 backdrop-blur-xl rounded-3xl border border-border/50 flex flex-col items-center justify-center p-8 shadow-2xl overflow-hidden relative group">
          
          {/* Animated Aurora Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none mix-blend-screen">
            <motion.div
              animate={{
                x: ["0%", "25%", "-25%", "0%"],
                y: ["0%", "-25%", "25%", "0%"],
                scale: [1, 1.2, 0.8, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={cn("absolute top-0 -left-1/4 w-[150%] h-[150%] bg-gradient-to-br rounded-full blur-[80px] opacity-40 transition-colors duration-1000", activeColor)}
            />
            <motion.div
              animate={{
                x: ["0%", "-30%", "20%", "0%"],
                y: ["0%", "30%", "-20%", "0%"],
                scale: [1, 0.9, 1.1, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={cn("absolute -bottom-1/4 -right-1/4 w-[120%] h-[120%] bg-gradient-to-tl rounded-full blur-[100px] opacity-50 transition-colors duration-1000", activeColor)}
            />
          </div>
          
          {/* Base gradient fallback */}
          <div className={cn("absolute inset-0 bg-gradient-to-br transition-colors duration-700 opacity-20", activeColor)} />
          
          <motion.div
            key={activeCard}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0 }}
            className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center gap-8"
          >
            <div className={cn("h-36 w-36 rounded-2xl flex items-center justify-center bg-card shadow-2xl border border-border/50 backdrop-blur-md relative transform transition-all duration-500 hover:scale-105", activeIconColor)}>
              <div className="absolute inset-0 rounded-2xl bg-current opacity-10 blur-xl animate-pulse delay-100" />
              <ActiveIcon className="h-16 w-16" />
              
              {/* Corner decorative elements */}
              <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-background border border-border" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-background border border-border" />
            </div>
            
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border backdrop-blur-sm">
                <span className={cn("h-2 w-2 rounded-full animate-ping", activeCard % 2 === 0 ? "bg-primary" : "bg-cyan")} />
                <span className="text-xs font-medium font-mono uppercase tracking-wider">{activeSection.title} PROCESS ACTIVE</span>
              </div>
              <div className="text-sm text-muted-foreground max-w-xs mx-auto">
                System is actively applying {activeSection.title.toLowerCase()} models and generating contextual data for portfolio decisions.
              </div>
            </div>
          </motion.div>
          
          {/* Animated decorative grid in background */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl opacity-50" 
               style={{ 
                 backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(124, 58, 237, 0.15) 1px, transparent 0)',
                 backgroundSize: '32px 32px' 
               }} 
          />
        </div>
      </div>
    </div>
  )
}
