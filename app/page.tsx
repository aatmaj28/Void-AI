"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect, useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sphere, Points, PointMaterial } from "@react-three/drei"
import * as THREE from "three"
import {
  Search,
  Brain,
  MessageSquare,
  Bell,
  Filter,
  ArrowRight,
  Sun,
  Moon,
  TrendingUp,
  Database,
  Sparkles,
  Target,
  User,
  Settings,
  Key,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import { Footer } from "@/components/footer"
import { useUser } from "@/lib/user-context"
import { AnimatedStepper } from "@/components/animated-stepper"
import { ScrollReveal, ScrollRevealContainer } from "@/components/scroll-reveal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"

const features = [
  {
    icon: Search,
    title: "Coverage Gap Detection",
    description:
      "Identify stocks with high trading activity but minimal Wall Street analyst coverage.",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description:
      "Advanced algorithms score opportunities and generate investment hypotheses automatically.",
  },
  {
    icon: MessageSquare,
    title: "RAG Research Assistant",
    description:
      "Chat with your data using our retrieval-augmented generation system for deeper insights.",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    description:
      "Get notified when new opportunities emerge or existing gaps widen significantly.",
  },
  {
    icon: Filter,
    title: "Smart Screening",
    description:
      "Build custom screens to filter opportunities by sector, market cap, and gap scores.",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Analytics",
    description:
      "Track performance and optimize your portfolio with data-driven insights and recommendations.",
  },
]

const steps = [
  {
    icon: Database,
    title: "INGEST",
    description: "Aggregate market data, analyst coverage, and trading activity",
  },
  {
    icon: Target,
    title: "SCORE",
    description: "Calculate coverage gaps and opportunity scores",
  },
  {
    icon: Brain,
    title: "ANALYZE",
    description: "Generate AI-powered investment hypotheses",
  },
  {
    icon: Sparkles,
    title: "SURFACE",
    description: "Present actionable opportunities with full context",
  },
]

// 3D Globe Component
function MarketGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state: any) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
    }
  })

  const coverageData = useMemo(() => {
    const points = []
    for (let i = 0; i < 100; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const radius = 2.1
      
      points.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      )
    }
    return new Float32Array(points)
  }, [])

  return (
    <group>
      <Sphere ref={meshRef} args={[2, 64, 64]}>
        <meshPhongMaterial
          color="#0a0a0a"
          wireframe
          opacity={0.3}
          transparent
        />
      </Sphere>
      <Points positions={coverageData} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#00ff88"
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  )
}

// Particle System Component with Mouse Following
function VoidParticleSystem({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const pointsRef = useRef<THREE.Points>(null)
  const originalPositions = useRef<Float32Array | null>(null)
  
  const particles = useMemo(() => {
    const positions = new Float32Array(3000)
    const colors = new Float32Array(3000)
    
    for (let i = 0; i < 1000; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 10
      positions[i3 + 1] = (Math.random() - 0.5) * 10
      positions[i3 + 2] = (Math.random() - 0.5) * 10
      
      // Create voids (empty spaces) by clustering particles
      const isVoid = Math.random() > 0.7
      colors[i3] = isVoid ? 0.1 : 0.2
      colors[i3 + 1] = isVoid ? 0.8 : 0.6
      colors[i3 + 2] = isVoid ? 1.0 : 0.9
    }
    
    originalPositions.current = positions.slice()
    return { positions, colors }
  }, [])

  useFrame((state: any) => {
    if (pointsRef.current && originalPositions.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
      
      // Mouse influence
      const mouseX = mousePosition.x * 5
      const mouseY = -mousePosition.y * 5
      
      for (let i = 0; i < positions.length; i += 3) {
        const originalX = originalPositions.current[i]
        const originalY = originalPositions.current[i + 1]
        const originalZ = originalPositions.current[i + 2]
        
        // Calculate distance from mouse position
        const dx = originalX - mouseX
        const dy = originalY - mouseY
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Apply mouse repulsion effect
        const force = Math.max(0, 1 - distance / 3)
        const repulsion = force * 0.5
        
        positions[i] = originalX + dx * repulsion
        positions[i + 1] = originalY + dy * repulsion
        positions[i + 2] = originalZ
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true
      
      // Gentle rotation
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.05
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.03
    }
  })

  return (
    <Points ref={pointsRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan/20 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/10 rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-cyan/10 rounded-full" />
    </div>
  )
}

function FloatingCards() {
  const cards = [
    { ticker: "IONQ", change: "+12.4%", type: "positive" },
    { ticker: "BTDR", change: "+8.7%", type: "positive" },
    { ticker: "NVAX", change: "-3.2%", type: "negative" },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
      {cards.map((card, i) => (
        <div
          key={card.ticker}
          className={`absolute bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg ${i === 0
            ? "top-32 right-24 animate-float"
            : i === 1
              ? "top-48 right-48 animate-float-delayed"
              : "top-64 right-16 animate-float-slow"
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-sm font-mono font-semibold">{card.ticker}</div>
            <div
              className={`text-sm font-mono ${card.type === "positive" ? "text-success" : "text-destructive"
                }`}
            >
              {card.change}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Gap Score: 89</div>
        </div>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, logout, isLoading } = useUser()
  const router = useRouter()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [headlineIndex, setHeadlineIndex] = useState(0)
  const [displayedLength, setDisplayedLength] = useState(0)
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting" | "pause">("typing")
  const [showCursor, setShowCursor] = useState(true)
  const typewriterRef = useRef<{ phase: typeof phase; headlineIndex: number; startTime: number; holdUntil: number }>({
    phase: "typing",
    headlineIndex: 0,
    startTime: 0,
    holdUntil: 0,
  })

  const headlines = useMemo(() => [
    "We find alpha in the void",
    "We spot what Wall Street misses",
    "We uncover hidden opportunities",
  ], [])

  useEffect(() => {
    setMounted(true)

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      })
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)
    return () => clearInterval(cursorInterval)
  }, [])

  // Smooth typewriter: time-based with requestAnimationFrame
  useEffect(() => {
    const typingSpeedMs = 45
    const deletingSpeedMs = 25
    const pauseBeforeDeleteMs = 2000
    const pauseBeforeTypeMs = 400
    const currentHeadline = headlines[headlineIndex]
    const fullLength = currentHeadline.length

    typewriterRef.current = {
      phase,
      headlineIndex,
      startTime: typewriterRef.current.startTime,
      holdUntil: typewriterRef.current.holdUntil,
    }

    let rafId: number

    const tick = (now: number) => {
      const ref = typewriterRef.current

      if (ref.phase === "hold") {
        if (now >= ref.holdUntil) {
          setPhase("deleting")
          typewriterRef.current.phase = "deleting"
          typewriterRef.current.startTime = now
        }
        rafId = requestAnimationFrame(tick)
        return
      }

      if (ref.phase === "pause") {
        if (now >= ref.holdUntil) {
          setHeadlineIndex((i) => (i + 1) % 3)
          setPhase("typing")
          setDisplayedLength(0)
          typewriterRef.current.phase = "typing"
          typewriterRef.current.headlineIndex = (typewriterRef.current.headlineIndex + 1) % 3
          typewriterRef.current.startTime = now
        }
        rafId = requestAnimationFrame(tick)
        return
      }

      const elapsed = now - ref.startTime
      const speed = ref.phase === "typing" ? typingSpeedMs : deletingSpeedMs
      const steps = Math.floor(elapsed / speed)
      const newLen = ref.phase === "typing"
        ? Math.min(fullLength, steps)
        : Math.max(0, fullLength - steps)

      setDisplayedLength(newLen)

      if (ref.phase === "typing" && newLen >= fullLength) {
        setPhase("hold")
        typewriterRef.current.phase = "hold"
        typewriterRef.current.holdUntil = now + pauseBeforeDeleteMs
      } else if (ref.phase === "deleting" && newLen <= 0) {
        setPhase("pause")
        typewriterRef.current.phase = "pause"
        typewriterRef.current.holdUntil = now + pauseBeforeTypeMs
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame((now) => {
      typewriterRef.current.startTime = now
      tick(now)
    })

    return () => cancelAnimationFrame(rafId)
  }, [phase, headlineIndex, headlines])

  // Sync displayedLength when headline index changes (after pause)
  useEffect(() => {
    if (phase === "typing" && displayedLength === 0) {
      typewriterRef.current.startTime = performance.now()
    }
  }, [headlineIndex, phase, displayedLength])

  const displayedText = headlines[headlineIndex]?.slice(0, displayedLength) ?? ""

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )
              ) : (
                <div className="h-5 w-5" />
              )}
            </Button>

            {/* Conditionally show Sign In/Get Started or User Avatar */}
            {!isLoading && user ? (
              <>
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-cyan flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-foreground">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - transition for smooth boundaries */}
      <section className="relative flex-1 flex items-center justify-center py-20 md:py-32 overflow-hidden transition-[min-height,padding] duration-300 ease-out">
        {/* Particle System Visualization with Mouse Following */}
        <div className="absolute inset-0 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 8], fov: 75 }}>
            <ambientLight intensity={0.3} />
            <VoidParticleSystem mousePosition={mousePosition} />
          </Canvas>
        </div>
        
        <AnimatedBackground />
        <FloatingCards />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm text-muted-foreground">
                Where Wall Street Isn't Looking
              </span>
            </div>

            {/* Fixed min-height so section doesn't expand/contract when headline wraps to 2 lines */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance relative min-h-[2.35em] flex items-center justify-center">
              <span className="inline-block">
                {(() => {
                  const text = displayedText
                  const currentHeadline = headlines[headlineIndex]
                  if (!currentHeadline) return null

                  const highlights: { [key: number]: { start: number; end: number } } = {
                    0: { start: 8, end: 13 },
                    1: { start: 13, end: 24 },
                    2: { start: 3, end: 10 },
                  }
                  const highlight = highlights[headlineIndex]
                  const beforeHighlight = text.slice(0, Math.min(text.length, highlight.start))
                  const highlightedPart = text.slice(highlight.start, Math.min(text.length, highlight.end))
                  const afterHighlight = text.slice(highlight.end)

                  return (
                    <>
                      {beforeHighlight}
                      {highlightedPart && (
                        <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
                          {highlightedPart}
                        </span>
                      )}
                      {afterHighlight}
                      <span
                        className={`inline-block w-[3px] h-[0.9em] bg-primary ml-1 align-middle transition-opacity duration-150 ${
                          showCursor ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </>
                  )
                })()}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
              AI-powered detection of under-covered stocks with high market
              activity. Discover investment opportunities before the crowd.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Show Get Started only when not logged in */}
              {!user && (
                <Button
                  size="lg"
                  asChild
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
                >
                  <Link href="/register">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {/* Show View Opportunities only when logged in */}
              {user && (
                <Button size="lg" asChild className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/dashboard">
                    <TrendingUp className="h-4 w-4" />
                    View Opportunities
                  </Link>
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">
                  500+
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Stocks Tracked
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
                  47
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Active Opportunities
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">
                  92%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Avg Gap Score
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      
      {/* Features Section */}
      <section className="py-20 md:py-32 bg-card/50">
        <div className="container mx-auto px-4">
          <ScrollReveal direction="up" duration={0.6}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Powerful Features for{" "}
                <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
                  Alpha Generation
                </span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our platform combines advanced analytics with AI to surface
                investment opportunities that others miss.
              </p>
            </div>
          </ScrollReveal>

          <ScrollRevealContainer staggerDelay={0.08}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <ScrollReveal key={feature.title} direction="up" delay={index * 0.05}>
                  <Card
                    className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </ScrollRevealContainer>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <ScrollReveal direction="up" duration={0.6}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our four-step process turns raw market data into actionable
                investment insights.
              </p>
            </div>
          </ScrollReveal>

          <AnimatedStepper steps={steps} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-background to-cyan/10">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal direction="up" duration={0.6}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {user ? "Your opportunities await" : "Ready to explore the void?"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              {user
                ? "Continue exploring under-covered investment opportunities in your dashboard."
                : "Start discovering under-covered investment opportunities today. No credit card required."
              }
            </p>
            <Button
              size="lg"
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
            >
              <Link href={user ? "/dashboard" : "/register"}>
                {user ? "Go to Dashboard" : "Get Started Free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <Footer />

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes float-delayed {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        @keyframes float-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        :global(.animate-float) {
          animation: float 3s ease-in-out infinite;
        }
        :global(.animate-float-delayed) {
          animation: float-delayed 4s ease-in-out infinite;
        }
        :global(.animate-float-slow) {
          animation: float-slow 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
