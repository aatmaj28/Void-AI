"use client"

import React from "react"

import { useState, use } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Star,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Activity,
  FileText,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  mockStocks,
  mockHypothesis,
  formatMarketCap,
  formatVolume,
  formatPercent,
} from "@/lib/mock-data"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]

function GapScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          className="text-secondary"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="url(#gaugeGradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">Gap Score</span>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const percentage = (value / max) * 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-cyan rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  variant = "default",
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: "default" | "bull" | "bear" | "base"
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const variantStyles = {
    default: "border-border",
    bull: "border-success/30 bg-success/5",
    bear: "border-destructive/30 bg-destructive/5",
    base: "border-primary/30 bg-primary/5",
  }

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params)
  const [activeTab, setActiveTab] = useState("overview")
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: `Hello! I'm your AI research assistant for ${ticker}. Ask me anything about this stock, its coverage gap, or investment thesis.`,
    },
  ])
  const [chatInput, setChatInput] = useState("")

  const stock = mockStocks.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase())

  if (!stock) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Stock Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The stock {ticker} was not found in our database.
          </p>
          <Button asChild>
            <Link href="/opportunities">Back to Opportunities</Link>
          </Button>
        </div>
      </div>
    )
  }

  const priceChartData = stock.priceHistory.map((price, index) => ({
    day: index + 1,
    price,
  }))

  const coverageData = [
    { name: "This Stock", value: stock.analystCount },
    { name: "Sector Avg", value: 12 },
    { name: "Market Avg", value: 18 },
  ]

  const ratingsData = [
    { name: "Buy", value: 2, color: "#10b981" },
    { name: "Hold", value: 1, color: "#f59e0b" },
    { name: "Sell", value: 0, color: "#ef4444" },
  ]

  const documents = [
    { type: "10-K", date: "2024-12-15", title: "Annual Report 2024" },
    { type: "10-Q", date: "2024-11-08", title: "Quarterly Report Q3 2024" },
    { type: "8-K", date: "2024-10-22", title: "Current Report - Executive Changes" },
    { type: "10-Q", date: "2024-08-09", title: "Quarterly Report Q2 2024" },
    { type: "8-K", date: "2024-07-15", title: "Current Report - Earnings Release" },
  ]

  const handleSendMessage = () => {
    if (!chatInput.trim()) return

    setChatMessages((prev) => [...prev, { role: "user", content: chatInput }])

    // Simulate AI response
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Based on my analysis of ${stock.ticker}, the coverage gap is primarily driven by the stock's relatively small market cap of ${formatMarketCap(stock.marketCap)} combined with high trading activity. The ${stock.analystCount} analysts currently covering the stock are significantly below the sector average of 12.`,
        },
      ])
    }, 1000)

    setChatInput("")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6 -ml-2">
        <Link href="/opportunities" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Opportunities
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono">{stock.ticker}</h1>
            <Badge variant="secondary" className="text-sm">
              {stock.sector}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {stock.industry}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground">{stock.company}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-2xl font-mono font-bold">${stock.price.toFixed(2)}</span>
            <span
              className={`flex items-center gap-1 font-mono ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}
            >
              {stock.changePercent >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {formatPercent(stock.changePercent)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent">
            <Star className="h-4 w-4" />
            Add to Watchlist
          </Button>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" />
            Generate Analysis
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2">
            <Users className="h-4 w-4" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Key Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Key Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="text-lg font-mono font-semibold">
                      {formatMarketCap(stock.marketCap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">P/E Ratio</p>
                    <p className="text-lg font-mono font-semibold">
                      {stock.pe ? stock.pe.toFixed(1) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Volume</p>
                    <p className="text-lg font-mono font-semibold">
                      {formatVolume(stock.volume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Volume</p>
                    <p className="text-lg font-mono font-semibold">
                      {formatVolume(stock.avgVolume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">52W High</p>
                    <p className="text-lg font-mono font-semibold">${stock.high52w.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">52W Low</p>
                    <p className="text-lg font-mono font-semibold">${stock.low52w.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Analyst Count</p>
                    <p className="text-lg font-mono font-semibold">{stock.analystCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Activity Score</p>
                    <p className="text-lg font-mono font-semibold">{stock.activityScore}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gap Score */}
            <Card>
              <CardHeader>
                <CardTitle>Gap Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <GapScoreGauge score={stock.gapScore} />
                <div className="w-full mt-6 space-y-3">
                  <ScoreBar label="Coverage Gap" value={stock.gapScore} />
                  <ScoreBar label="Activity Level" value={stock.activityScore} />
                  <ScoreBar label="Volatility" value={Math.floor(Math.random() * 30 + 40)} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Price History (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceChartData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#141417",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Analyst Count</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="text-5xl font-bold text-primary">{stock.analystCount}</div>
                <p className="text-muted-foreground mt-2">Active Analysts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coverage vs Peers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coverageData} layout="vertical">
                      <XAxis type="number" axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#141417",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analyst Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ratingsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {ratingsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {ratingsData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Price Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Low</p>
                  <p className="text-xl font-mono font-semibold text-destructive">
                    ${(stock.price * 0.7).toFixed(2)}
                  </p>
                </div>
                <div className="flex-1 h-2 bg-secondary rounded-full relative">
                  <div
                    className="absolute h-4 w-1 bg-foreground rounded-full -top-1"
                    style={{ left: "30%" }}
                  />
                  <div
                    className="absolute h-4 w-1 bg-primary rounded-full -top-1"
                    style={{ left: "50%" }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">High</p>
                  <p className="text-xl font-mono font-semibold text-success">
                    ${(stock.price * 1.5).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex justify-center mt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Median Target</p>
                  <p className="text-2xl font-mono font-bold">${(stock.price * 1.15).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Relative Volume</p>
                  <p className="text-4xl font-mono font-bold">
                    {(stock.volume / stock.avgVolume).toFixed(2)}x
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">vs 20-day average</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Activity Score</p>
                  <p className="text-4xl font-mono font-bold text-primary">{stock.activityScore}</p>
                  <p className="text-sm text-muted-foreground mt-2">High activity detected</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">30-Day Volatility</p>
                  <p className="text-4xl font-mono font-bold">
                    {Math.abs(stock.high52w - stock.low52w) / stock.price * 10}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">Annualized</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volume History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stock.priceHistory.map((_, i) => ({
                      day: i + 1,
                      volume: Math.floor(stock.avgVolume * (0.5 + Math.random())),
                    }))}
                  >
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#141417",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatVolume(value), "Volume"]}
                    />
                    <Bar dataKey="volume" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Investment Hypothesis</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-generated analysis based on coverage gap and market data
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <Badge variant="secondary" className="font-mono">
                  {mockHypothesis.confidence}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{mockHypothesis.hypothesis}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CollapsibleCard title="Bull Case" variant="bull">
              <ul className="space-y-2">
                {mockHypothesis.bullCase.points.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleCard>

            <CollapsibleCard title="Base Case" variant="base">
              <ul className="space-y-2">
                {mockHypothesis.baseCase.points.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Activity className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleCard>

            <CollapsibleCard title="Bear Case" variant="bear">
              <ul className="space-y-2">
                {mockHypothesis.bearCase.points.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Catalysts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockHypothesis.catalysts.map((catalyst, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{catalyst.event}</p>
                        <p className="text-xs text-muted-foreground">{catalyst.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockHypothesis.risks.map((risk, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{risk.risk}</span>
                      <Badge
                        variant="outline"
                        className={
                          risk.severity === "high"
                            ? "border-destructive/50 text-destructive"
                            : risk.severity === "medium"
                              ? "border-warning/50 text-warning"
                              : "border-muted-foreground/50 text-muted-foreground"
                        }
                      >
                        {risk.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <RefreshCw className="h-4 w-4" />
              Regenerate Analysis
            </Button>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEC Filings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          doc.type === "10-K"
                            ? "border-primary/50 text-primary"
                            : doc.type === "10-Q"
                              ? "border-cyan/50 text-cyan"
                              : "border-warning/50 text-warning"
                        }
                      >
                        {doc.type}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.date}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>RAG Research Assistant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ask questions about {stock.ticker} and get AI-powered answers
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {chatMessages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested Questions */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "Why is this stock under-covered?",
                  "What are the main risks?",
                  "Compare to sector peers",
                ].map((question) => (
                  <Button
                    key={question}
                    variant="outline"
                    size="sm"
                    onClick={() => setChatInput(question)}
                    className="text-xs"
                  >
                    {question}
                  </Button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this stock..."
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
