"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect, useRef, useMemo } from "react"
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
  LogOut,
  Coins,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { Footer } from "@/components/footer"
import { useUser } from "@/lib/user-context"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

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
    number: "01",
    icon: Database,
    title: "Ingest",
    description: "Aggregate market data, analyst coverage, and trading activity across 2,000+ stocks daily.",
  },
  {
    number: "02",
    icon: Target,
    title: "Score",
    description: "Calculate coverage gaps and rank opportunities using our proprietary scoring engine.",
  },
  {
    number: "03",
    icon: Brain,
    title: "Analyze",
    description: "Generate AI-powered investment hypotheses with ML-optimized confidence scores.",
  },
  {
    number: "04",
    icon: Sparkles,
    title: "Surface",
    description: "Present actionable opportunities with full context, validated by LLM-as-a-Judge.",
  },
]

function ContactUsBlock() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("sending")
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setStatus("idle")
      setName("")
      setEmail("")
      setMessage("")
      toast({
        title: "Message sent",
        description: "We'll get back to you soon.",
      })
    } catch {
      setStatus("error")
      toast({
        title: "Failed to send",
        description: "Please try again or email us directly.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="text-left">
      <h3 className="text-xl font-semibold mb-2">Contact Us</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Northeastern University, Boston &middot; Spring 2026
      </p>
      <div className="flex items-center flex-nowrap gap-x-2 text-sm text-muted-foreground mb-4 shrink-0">
        <a href="mailto:salunke.aa@northeastern.edu" className="text-primary hover:underline whitespace-nowrap shrink-0">salunke.aa@northeastern.edu</a>
        <span className="text-muted-foreground/70 shrink-0">&middot;</span>
        <a href="mailto:mahendrakar.v@northeastern.edu" className="text-primary hover:underline whitespace-nowrap shrink-0">mahendrakar.v@northeastern.edu</a>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="contact-name" className="block mb-1.5">Name</Label>
          <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
        </div>
        <div>
          <Label htmlFor="contact-email" className="block mb-1.5">Email / Contact</Label>
          <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
        </div>
        <div>
          <Label htmlFor="contact-message" className="block mb-1.5">Message</Label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          />
        </div>
        <Button type="submit" disabled={status === "sending"} className="gap-2">
          {status === "sending" ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  )
}

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, logout, isLoading } = useUser()
  const router = useRouter()
  const [headlineIndex, setHeadlineIndex] = useState(0)
  const [displayedLength, setDisplayedLength] = useState(0)
  const [phase, setPhase] = useState<"typing" | "hold" | "deleting" | "pause">("typing")
  const [showCursor, setShowCursor] = useState(true)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isOpportunitiesLoading, setIsOpportunitiesLoading] = useState(true)

  useEffect(() => {
    fetchOpportunities()
      .then(setOpportunities)
      .catch((e) => console.error("Failed to fetch opportunities:", e))
      .finally(() => setIsOpportunitiesLoading(false))
  }, [])

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
  }, [])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)
    return () => clearInterval(cursorInterval)
  }, [])

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
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
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

            {!isLoading && user ? (
              <>
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
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
                        <User className="mr-2 h-4 w-4" />Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/crypto" className="cursor-pointer">
                        <Coins className="mr-2 h-4 w-4" />Crypto
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />Logout
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

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-20 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card mb-8">
              <span className="inline-flex rounded-full h-2 w-2 bg-success" />
              <span className="text-sm text-muted-foreground">
                Where Wall Street Isn&apos;t Looking
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-foreground text-balance relative min-h-[2.35em] flex items-center justify-center">
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
                        <span className="text-primary">
                          {highlightedPart}
                        </span>
                      )}
                      {afterHighlight}
                      <span
                        className={`inline-block w-[3px] h-[0.9em] bg-primary ml-1 align-middle transition-opacity duration-150 ${showCursor ? "opacity-100" : "opacity-0"}`}
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
              {!user && (
                <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8">
                  <Link href="/register">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
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
                  2000+
                </div>
                <div className="text-sm text-muted-foreground mt-1">Stocks Tracked</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  {isOpportunitiesLoading ? "..." : opportunities.filter((o) => o.gapScore >= 60).length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Active Opportunities</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">
                  {isOpportunitiesLoading ? "..." : opportunities.length ? (opportunities.reduce((s, o) => s + o.gapScore, 0) / opportunities.length).toFixed(1) : "\u2014"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Avg Gap Score</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for Alpha Generation
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform combines advanced analytics with AI to surface
              investment opportunities that others miss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 border-border hover:border-primary/20 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32 border-t border-border bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our four-step process turns raw market data into actionable
              investment insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="text-xs font-mono text-muted-foreground mb-3 tracking-widest">{step.number}</div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-1/2 w-8 h-px bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Contact Us Section */}
      <section className="py-20 md:py-32 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-32 items-start max-w-5xl mx-auto">
            <div className="text-left lg:justify-self-start lg:pr-4">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {user ? "Your opportunities await" : "Ready to explore the void?"}
              </h2>
              <p className="text-muted-foreground max-w-lg mb-8">
                {user
                  ? "Continue exploring under-covered investment opportunities in your dashboard."
                  : "Start discovering under-covered investment opportunities today. No credit card required."
                }
              </p>
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8">
                <Link href={user ? "/dashboard" : "/register"}>
                  {user ? "Go to Dashboard" : "Get Started Free"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="lg:justify-self-end lg:pl-4">
              <ContactUsBlock />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
