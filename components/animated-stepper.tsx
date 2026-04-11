"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { LucideIcon } from "lucide-react"

interface Step {
  icon: LucideIcon
  title: string
  description: string
}

interface AnimatedStepperProps {
  steps: Step[]
}

export function AnimatedStepper({ steps }: AnimatedStepperProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  const iconVariants = {
    hidden: { scale: 0, opacity: 0 },
    show: (i: number) => ({
      scale: 1,
      opacity: 1,
      transition: {
        delay: i * 0.15,
        duration: 0.5,
        ease: "easeOut",
        type: "spring",
        stiffness: 100,
      },
    }),
  }

  const lineVariants = {
    hidden: { scaleX: 0, opacity: 0 },
    show: {
      scaleX: 1,
      opacity: 1,
      transition: {
        delay: 0.3,
        duration: 1,
        ease: "easeInOut",
      },
    },
  }

  const textVariants = {
    hidden: { opacity: 0, y: 12 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.15 + 0.2,
        duration: 0.5,
        ease: "easeOut",
      },
    }),
  }

  const pulseVariants = {
    pulse: {},
  }

  return (
    <div ref={ref} className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
        {/* Animated Connector line - desktop only */}
        <motion.div
          className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-border origin-left"
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
          variants={lineVariants}
        />

        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            className="relative text-center"
            initial="hidden"
            animate={isInView ? "show" : "hidden"}
          >
            {/* Animated Icon Circle with Glow */}
            <div className="relative z-10 mx-auto w-24 h-24 mb-4">
              <motion.div
                className="absolute inset-0 rounded-full"
                variants={pulseVariants}
                initial={{ boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.7)" }}
                animate={isInView ? "pulse" : {}}
              />
              <motion.div
                className="relative h-full w-full rounded-full bg-card border border-border flex items-center justify-center"
                custom={index}
                variants={iconVariants}
                whileHover={{
                  scale: 1.05,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <step.icon className="h-10 w-10 text-primary" />
              </motion.div>
            </div>

            {/* Step Number */}
            <motion.div
              className="text-xs font-mono text-muted-foreground mb-2"
              custom={index}
              variants={textVariants}
              initial="hidden"
              animate={isInView ? "show" : "hidden"}
            >
              0{index + 1}
            </motion.div>

            {/* Step Title */}
            <motion.h3
              className="text-lg font-bold mb-2"
              custom={index}
              variants={textVariants}
              initial="hidden"
              animate={isInView ? "show" : "hidden"}
            >
              {step.title}
            </motion.h3>

            {/* Step Description */}
            <motion.p
              className="text-sm text-muted-foreground"
              custom={index}
              variants={textVariants}
              initial="hidden"
              animate={isInView ? "show" : "hidden"}
            >
              {step.description}
            </motion.p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
