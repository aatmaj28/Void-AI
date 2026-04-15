"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { sendChatMessageStream, type ChatMessage, type SourceDocument } from "@/lib/rag-chat"

// ─── Types ──────────────────────────────────────────────────────────────────

interface StockData {
  ticker: string
  name: string
  sector: string
  industry: string
  market_cap: number
  current_price: number
  price_change_1m: number
  change: number
  changePercent: number
  avg_volume_20d: number
  volume: number
  pe_ratio: number | null
  year_high: number
  year_low: number
  analyst_count: number
  gap_score: number
  activity_score: number
  quality_score: number
  coverage_score: number
  opportunity_type: string
}

interface PricePoint {
  date: string
  close: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "N/A"
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(1)}K`
  return `${prefix}${n.toFixed(2)}`
}

function scoreBadge(score: number) {
  if (score >= 75) return "default"
  if (score >= 50) return "secondary"
  return "outline"
}

function changeColor(val: number) {
  return val >= 0 ? "text-emerald-500" : "text-red-500"
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ComparePage() {
  const searchParams = useSearchParams()
  const tickers = (searchParams.get("tickers") || "").split(",").filter(Boolean).slice(0, 2)
  const [tickerA, tickerB] = tickers

  // Stock data
  const [stockA, setStockA] = useState<StockData | null>(null)
  const [stockB, setStockB] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)

  // Price history
  const [priceA, setPriceA] = useState<PricePoint[]>([])
  const [priceB, setPriceB] = useState<PricePoint[]>([])

  // Chat
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [chatSources, setChatSources] = useState<SourceDocument[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    const container = chatEndRef.current?.parentElement
    if (container) container.scrollTop = container.scrollHeight
  }, [messages, chatSending])

  // ─── Fetch stock data ───────────────────────────────────────────────────

  useEffect(() => {
    if (!tickerA || !tickerB) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/stock/${tickerA}`).then(r => r.json()),
      fetch(`/api/stock/${tickerB}`).then(r => r.json()),
      fetch(`/api/stock/${tickerA}/history?days=30`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/stock/${tickerB}/history?days=30`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([a, b, histA, histB]) => {
      setStockA(a.error ? null : a)
      setStockB(b.error ? null : b)
      const hA = Array.isArray(histA?.data) ? histA.data : []
      const hB = Array.isArray(histB?.data) ? histB.data : []
      setPriceA(hA.filter((d: { close: number | null }) => d.close != null).map((d: { date: string; close: number }) => ({ date: d.date, close: Number(d.close) })))
      setPriceB(hB.filter((d: { close: number | null }) => d.close != null).map((d: { date: string; close: number }) => ({ date: d.date, close: Number(d.close) })))
    }).catch(() => {
      setStockA(null)
      setStockB(null)
    }).finally(() => setLoading(false))
  }, [tickerA, tickerB])

  // ─── Chat ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || chatInput.trim()
    if (!msg || chatSending) return
    setChatInput("")
    setChatSending(true)

    const userMsg = { role: "user" as const, content: msg }
    setMessages(prev => [...prev, userMsg])

    let assistantContent = ""
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }))

    // Use global mode with a comparison-focused prompt
    sendChatMessageStream(
      msg,
      null,
      null,
      history,
      (token) => {
        assistantContent += token
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: assistantContent }
          return updated
        })
      },
      (sources) => setChatSources(sources),
      () => setChatSending(false),
      () => setChatSending(false),
    )
  }, [chatInput, chatSending, messages])

  // ─── Build chart data ──────────────────────────────────────────────────

  const priceChartData = (() => {
    const allDates = new Set([...priceA.map(d => d.date), ...priceB.map(d => d.date)])
    const mapA = Object.fromEntries(priceA.map(d => [d.date, d.close]))
    const mapB = Object.fromEntries(priceB.map(d => [d.date, d.close]))
    return Array.from(allDates).sort().map(date => ({
      date: date.slice(5),
      [tickerA]: mapA[date] ?? null,
      [tickerB]: mapB[date] ?? null,
    }))
  })()

  const scoreChartData = stockA && stockB ? [
    { metric: "Gap Score", [tickerA]: stockA.gap_score, [tickerB]: stockB.gap_score },
    { metric: "Activity", [tickerA]: stockA.activity_score, [tickerB]: stockB.activity_score },
    { metric: "Quality", [tickerA]: stockA.quality_score, [tickerB]: stockB.quality_score },
    { metric: "Coverage", [tickerA]: stockA.coverage_score, [tickerB]: stockB.coverage_score },
  ] : []

  // ─── Render ────────────────────────────────────────────────────────────

  if (!tickerA || !tickerB) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Compare Stocks</h1>
        <p className="text-muted-foreground mb-6">Select exactly 2 stocks from the Opportunities page to compare them.</p>
        <Link href="/opportunities">
          <Button><ArrowLeft className="h-4 w-4 mr-2" /> Go to Opportunities</Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading comparison data...</span>
      </div>
    )
  }

  if (!stockA || !stockB) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Stock Not Found</h1>
        <p className="text-muted-foreground mb-6">One or both tickers could not be found.</p>
        <Link href="/opportunities">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
        </Link>
      </div>
    )
  }

  const suggestedQuestions = [
    `Compare ${tickerA} and ${tickerB} — which has a stronger coverage gap opportunity?`,
    `What are the key risk differences between ${tickerA} and ${tickerB}?`,
    `Which stock between ${tickerA} and ${tickerB} has better growth potential?`,
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/opportunities" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back to Opportunities
          </Link>
          <h1 className="text-3xl font-bold">
            {stockA.ticker} vs {stockB.ticker}
          </h1>
          <p className="text-muted-foreground">{stockA.name} vs {stockB.name}</p>
        </div>
      </div>

      {/* Side-by-side summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[stockA, stockB].map((stock) => (
          <Card key={stock.ticker} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{stock.ticker}</CardTitle>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                </div>
                <Badge variant={scoreBadge(stock.gap_score)}>
                  Gap: {Math.round(stock.gap_score)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold">${stock.current_price.toFixed(2)}</span>
                <span className={`flex items-center gap-1 text-sm font-medium ${changeColor(stock.changePercent)}`}>
                  {stock.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Mkt Cap</span>
                  <span className="ml-auto font-medium">{fmt(stock.market_cap, "$")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Volume</span>
                  <span className="ml-auto font-medium">{fmt(stock.volume)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Analysts</span>
                  <span className="ml-auto font-medium">{stock.analyst_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">P/E</span>
                  <span className="ml-auto font-medium">{stock.pe_ratio?.toFixed(1) ?? "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">52W High</span>
                  <span className="ml-auto font-medium">${stock.year_high.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
                  <span className="text-muted-foreground">52W Low</span>
                  <span className="ml-auto font-medium">${stock.year_low.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{stock.sector}</Badge>
                <Badge variant="outline">{stock.opportunity_type}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Charts | Analysis | Chat */}
      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
                    <TabsTrigger value="chat">Compare Chat</TabsTrigger>
        </TabsList>

        {/* ── Charts Tab ──────────────────────────────────────────────── */}
        <TabsContent value="charts" className="space-y-6">
          {/* Price History */}
          <Card>
            <CardHeader>
              <CardTitle>Price History (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {priceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Area type="monotone" dataKey={tickerA} stroke="#14B8A6" fill="#14B8A6" fillOpacity={0.1} strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey={tickerB} stroke="#2DD4BF" fill="#2DD4BF" fillOpacity={0.1} strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">No price history available.</p>
              )}
            </CardContent>
          </Card>

          {/* Score Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Score Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey={tickerA} fill="#14B8A6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={tickerB} fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Head-to-Head</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Metric</th>
                      <th className="text-right py-3 px-4 font-medium">{tickerA}</th>
                      <th className="text-right py-3 px-4 font-medium">{tickerB}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { label: "Price", a: `$${stockA.current_price.toFixed(2)}`, b: `$${stockB.current_price.toFixed(2)}` },
                      { label: "Change (1M)", a: `${stockA.changePercent >= 0 ? "+" : ""}${stockA.changePercent.toFixed(2)}%`, b: `${stockB.changePercent >= 0 ? "+" : ""}${stockB.changePercent.toFixed(2)}%` },
                      { label: "Market Cap", a: fmt(stockA.market_cap, "$"), b: fmt(stockB.market_cap, "$") },
                      { label: "P/E Ratio", a: stockA.pe_ratio?.toFixed(1) ?? "N/A", b: stockB.pe_ratio?.toFixed(1) ?? "N/A" },
                      { label: "Volume", a: fmt(stockA.volume), b: fmt(stockB.volume) },
                      { label: "Avg Volume (20D)", a: fmt(stockA.avg_volume_20d), b: fmt(stockB.avg_volume_20d) },
                      { label: "Analyst Count", a: String(stockA.analyst_count), b: String(stockB.analyst_count) },
                      { label: "Gap Score", a: String(Math.round(stockA.gap_score)), b: String(Math.round(stockB.gap_score)) },
                      { label: "Activity Score", a: String(Math.round(stockA.activity_score)), b: String(Math.round(stockB.activity_score)) },
                      { label: "52W High", a: `$${stockA.year_high.toFixed(2)}`, b: `$${stockB.year_high.toFixed(2)}` },
                      { label: "52W Low", a: `$${stockA.year_low.toFixed(2)}`, b: `$${stockB.year_low.toFixed(2)}` },
                      { label: "Sector", a: stockA.sector, b: stockB.sector },
                      { label: "Industry", a: stockA.industry, b: stockB.industry },
                    ].map((row) => (
                      <tr key={row.label} className="hover:bg-muted/50">
                        <td className="py-3 px-4 text-muted-foreground">{row.label}</td>
                        <td className="py-3 px-4 text-right font-medium">{row.a}</td>
                        <td className="py-3 px-4 text-right font-medium">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Chat Tab ────────────────────────────────────────────────── */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="flex flex-col" style={{ height: "600px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5" />
                Compare {tickerA} vs {tickerB}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ask the AI to compare these stocks using SEC filings, financial data, and web sources.
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Bot className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Ask me anything about {tickerA} vs {tickerB}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestedQuestions.map((q, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                          onClick={() => sendMessage(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content || (chatSending && i === messages.length - 1 ? "..." : "")}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Sources */}
              {chatSources.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                  {chatSources.slice(0, 5).map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] shrink-0">
                      {s.source_type === "web" ? "Web" : s.source_type === "sec_filing" ? s.form_type || "SEC" : "Profile"} — {s.ticker}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage() }}
                className="flex gap-2"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask about ${tickerA} vs ${tickerB}...`}
                  disabled={chatSending}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={chatSending || !chatInput.trim()}>
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
