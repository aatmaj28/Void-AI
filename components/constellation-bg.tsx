"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let particles: Particle[] = []

    // Wait for theme to be available
    if (theme === "system") return

    // Set colors based on theme
    const isDark = theme !== "light"
    const dotColor = isDark ? "rgba(124, 58, 237, 0.4)" : "rgba(124, 58, 237, 0.3)" // Primary color
    const lineColor = isDark ? "rgba(6, 182, 212, 0.15)" : "rgba(6, 182, 212, 0.1)" // Cyan color

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number

      constructor(width: number, height: number) {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.4
        this.vy = (Math.random() - 0.5) * 0.4
        this.size = Math.random() * 2 + 0.5
      }

      update(width: number, height: number) {
        this.x += this.vx
        this.y += this.vy

        if (this.x < 0 || this.x > width) this.vx *= -1
        if (this.y < 0 || this.y > height) this.vy *= -1
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.fill()
      }
    }

    const init = () => {
      const parent = canvas.parentElement
      if (!parent) return
      
      // Improve resolution
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight

      const particleCount = Math.floor((canvas.width * canvas.height) / 12000)
      particles = Array.from({ length: Math.min(particleCount, 150) }, () => new Particle(canvas.width, canvas.height))
    }

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = lineColor
            ctx.lineWidth = (1 - distance / 120) * 0.8
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(particle => {
        particle.update(canvas.width, canvas.height)
        particle.draw(ctx)
      })
      
      drawLines()
      animationFrameId = requestAnimationFrame(animate)
    }

    init()
    animate()

    let resizeTimer: any
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(init, 100)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 mix-blend-screen"
      style={{ opacity: 0.8 }}
    />
  )
}
