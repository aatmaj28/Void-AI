"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import { Footer } from "@/components/footer"

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
          className={`absolute bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg ${
            i === 0
              ? "top-32 right-24 animate-float"
              : i === 1
                ? "top-48 right-48 animate-float-delayed"
                : "top-64 right-16 animate-float-slow"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-sm font-mono font-semibold">{card.ticker}</div>
            <div
              className={`text-sm font-mono ${
                card.type === "positive" ? "text-success" : "text-destructive"
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

  useEffect(() => {
    setMounted(true)
  }, [])

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
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center py-20 md:py-32 overflow-hidden">
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

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
              We find{" "}
              <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
                alpha
              </span>{" "}
              in the void
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
              AI-powered detection of under-covered stocks with high market
              activity. Discover investment opportunities before the crowd.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                asChild
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
              >
                <Link href="/dashboard">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2 px-8 bg-transparent">
                <Link href="/opportunities">
                  <TrendingUp className="h-4 w-4" />
                  View Opportunities
                </Link>
              </Button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
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
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our four-step process turns raw market data into actionable
              investment insights.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              {/* Connector line - desktop only */}
              <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary via-cyan to-primary" />

              {steps.map((step, index) => (
                <div key={step.title} className="relative text-center">
                  <div className="relative z-10 mx-auto h-24 w-24 rounded-full bg-card border-2 border-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mb-2">
                    0{index + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-background to-cyan/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to explore the void?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Start discovering under-covered investment opportunities today. No
            credit card required.
          </p>
          <Button
            size="lg"
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
          >
            <Link href="/register">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
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
