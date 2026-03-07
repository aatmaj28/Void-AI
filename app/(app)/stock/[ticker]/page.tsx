"use client"

import React, { useState, use, useEffect, useRef } from "react"
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
import { mockHypothesis, formatMarketCap, formatVolume, formatPercent } from "@/lib/mock-data"
import { sendChatMessage } from "@/lib/rag-chat"
import { ChatBubble, ThinkingBubble } from "@/components/chat-bubble"
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
        <circle cx="64" cy="64" r="45" stroke="currentColor" strokeWidth="10" fill="none" className="text-secondary" />
        <circle cx="64" cy="64" r="45" stroke="url(#gaugeGradient)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />
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
        <div className="h-full bg-gradient-to-r from-primary to-cyan rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function CollapsibleCard({ title, children, defaultOpen = true, variant = "default" }: { title: string; children: React.ReactNode; defaultOpen?: boolean; variant?: "default" | "bull" | "bear" | "base" }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const variantStyles = { default: "border-border", bull: "border-success/30 bg-success/5", bear: "border-destructive/30 bg-destructive/5", base: "border-primary/30 bg-primary/5" }
  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="cursor-pointer flex flex-row items-center justify-between py-3" onClick={() => setIsOpen(!isOpen)}>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

type StockDetail = {
  ticker: string; company: string; sector: string; industry: string; marketCap: number; price: number; change: number; changePercent: number; analystCount: number; gapScore: number; activityScore: number; opportunityType: string; high52w: number; low52w: number; volume: number; avgVolume: number; pe: number | null; priceHistory: number[]
}

type NewsItem = { id: number; source: string; headline: string; url: string; datetime: number; summary: string; image: string | null }

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: tickerParam } = use(params)
  const ticker = tickerParam?.toUpperCase() ?? ""
  const [activeTab, setActiveTab] = useState("overview")
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: `Hello! I'm your AI research assistant for ${ticker}. Ask me anything about this stock, its coverage gap, or investment thesis.` },
  ])
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [stock, setStock] = useState<StockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [secFilings, setSecFilings] = useState<Array<{ type: string; date: string; title: string; url: string }>>([])
  const [secFilingsLoading, setSecFilingsLoading] = useState(false)
  const [secFilingsError, setSecFilingsError] = useState<string | null>(null)
  const [volumeHistory, setVolumeHistory] = useState<Array<{ date: string; volume: number }>>([])
  const [volumeHistoryLoading, setVolumeHistoryLoading] = useState(false)

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, chatSending])

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/stock/${ticker}`)
      .then((res) => { if (!res.ok) { if (res.status === 404) return null; throw new Error(res.statusText) } return res.json() })
      .then((data) => {
        if (!data) { setStock(null); return }
        setStock({
          ticker: data.ticker, company: data.name ?? data.ticker, sector: data.sector ?? "Unknown", industry: data.industry ?? "", marketCap: data.market_cap ?? 0, price: data.current_price ?? 0, change: data.change ?? 0, changePercent: data.changePercent ?? 0, analystCount: data.analyst_count ?? 0, gapScore: Math.round(data.gap_score ?? 0), activityScore: Math.round(data.activity_score ?? 0), opportunityType: data.opportunity_type ?? "Low Priority", high52w: data.year_high ?? 0, low52w: data.year_low ?? 0, volume: data.volume ?? 0, avgVolume: data.avg_volume_20d ?? data.avgVolume ?? 0, pe: typeof data.pe_ratio === "number" ? data.pe_ratio : data.pe ?? null, priceHistory: [],
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setNewsLoading(true); setNewsError(null)
    fetch(`/api/stock/${ticker}/news`)
      .then((res) => { if (!res.ok) throw new Error(res.statusText); return res.json() })
      .then((data: NewsItem[]) => setNews(Array.isArray(data) ? data : []))
      .catch(() => setNewsError("Failed to load news"))
      .finally(() => setNewsLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setSecFilingsLoading(true); setSecFilingsError(null)
    fetch(`/api/stock/${ticker}/sec-filings`)
      .then((res) => { if (!res.ok) { throw new Error(res.status === 404 ? "No SEC filings found for this ticker" : "Failed to load SEC filings") } return res.json() })
      .then((data: { filings?: Array<{ type: string; date: string; title: string; url: string }> }) => setSecFilings(Array.isArray(data?.filings) ? data.filings : []))
      .catch((e) => { setSecFilingsError(e instanceof Error ? e.message : "Failed to load SEC filings"); setSecFilings([]) })
      .finally(() => setSecFilingsLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setVolumeHistoryLoading(true)
    fetch(`/api/stock/${ticker}/history?days=30`)
      .then((res) => { if (!res.ok) throw new Error("Failed to load volume history"); return res.json() })
      .then((data: { data?: Array<{ date: string; volume: number }> }) => {
        const list = Array.isArray(data?.data) ? data.data : []
        setVolumeHistory(list.map((d) => ({ date: d.date, volume: Number(d.volume) || 0 })))
      })
      .catch(() => setVolumeHistory([]))
      .finally(() => setVolumeHistoryLoading(false))
  }, [ticker])

  if (loading) return (<div className="container mx-auto px-4 py-8"><h1 className="text-2xl font-bold">Loading {ticker}…</h1><div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div></div>)
  if (error) return (<div className="container mx-auto px-4 py-8"><div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">{error}</div><Button asChild className="mt-4"><Link href="/opportunities">Back to Opportunities</Link></Button></div>)
  if (!stock) return (<div className="container mx-auto px-4 py-8"><div className="text-center py-20"><h1 className="text-2xl font-bold mb-2">Stock Not Found</h1><p className="text-muted-foreground mb-4">The stock {ticker} was not found in our database.</p><Button asChild><Link href="/opportunities">Back to Opportunities</Link></Button></div></div>)

  const priceChartData = (stock.priceHistory.length ? stock.priceHistory : [stock.price]).map((p, index) => ({ day: index + 1, price: typeof p === "number" ? p : stock.price }))
  const coverageData = [{ name: "This Stock", value: stock.analystCount }, { name: "Sector Avg", value: 12 }, { name: "Market Avg", value: 18 }]
  const ratingsData = [{ name: "Buy", value: 2, color: "#10b981" }, { name: "Hold", value: 1, color: "#f59e0b" }, { name: "Sell", value: 0, color: "#ef4444" }]

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatSending) return
    const userMessage = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setChatInput("")
    setChatSending(true)
    try {
      const history = chatMessages.filter((_, i) => i > 0).map((m) => ({ role: m.role, content: m.content }))
      const response = await sendChatMessage(userMessage, ticker, history)
      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }])
    } catch (error) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.` }])
    } finally {
      setChatSending(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" asChild className="mb-6 -ml-2"><Link href="/opportunities" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Opportunities</Link></Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono">{stock.ticker}</h1>
            <Badge variant="secondary" className="text-sm">{stock.sector}</Badge>
            <Badge variant="outline" className="text-sm">{stock.industry}</Badge>
          </div>
          <p className="text-lg text-muted-foreground">{stock.company}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-2xl font-mono font-bold">${stock.price.toFixed(2)}</span>
            <span className={`flex items-center gap-1 font-mono ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}>
              {stock.changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatPercent(stock.changePercent)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent"><Star className="h-4 w-4" />Add to Watchlist</Button>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><RefreshCw className="h-4 w-4" />Generate Analysis</Button>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2"><Users className="h-4 w-4" />Coverage</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2"><Activity className="h-4 w-4" />Activity</TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2"><TrendingUp className="h-4 w-4" />AI Analysis</TabsTrigger>
          <TabsTrigger value="news" className="gap-2"><FileText className="h-4 w-4" />News</TabsTrigger>
          <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documents</TabsTrigger>
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-4 w-4" />Chat</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Key Statistics</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div><p className="text-sm text-muted-foreground">Market Cap</p><p className="text-lg font-mono font-semibold">{formatMarketCap(stock.marketCap)}</p></div>
                  <div><p className="text-sm text-muted-foreground">P/E Ratio</p><p className="text-lg font-mono font-semibold">{stock.pe ? stock.pe.toFixed(1) : "N/A"}</p></div>
                  <div><p className="text-sm text-muted-foreground">Volume</p><p className="text-lg font-mono font-semibold">{formatVolume(stock.volume)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Avg Volume</p><p className="text-lg font-mono font-semibold">{formatVolume(stock.avgVolume)}</p></div>
                  <div><p className="text-sm text-muted-foreground">52W High</p><p className="text-lg font-mono font-semibold">${stock.high52w.toFixed(2)}</p></div>
                  <div><p className="text-sm text-muted-foreground">52W Low</p><p className="text-lg font-mono font-semibold">${stock.low52w.toFixed(2)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Analyst Count</p><p className="text-lg font-mono font-semibold">{stock.analystCount}</p></div>
                  <div><p className="text-sm text-muted-foreground">Activity Score</p><p className="text-lg font-mono font-semibold">{stock.activityScore}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Gap Score</CardTitle></CardHeader>
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
          <Card>
            <CardHeader><CardTitle>Price History (30 Days)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceChartData}>
                    <defs><linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#a1a1aa", fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{ backgroundColor: "#141417", border: "1px solid #27272a", borderRadius: "8px" }} formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]} />
                    <Area type="monotone" dataKey="price" stroke="#7c3aed" strokeWidth={2} fill="url(#priceGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card><CardHeader><CardTitle>Analyst Count</CardTitle></CardHeader><CardContent className="flex flex-col items-center"><div className="text-5xl font-bold text-primary">{stock.analystCount}</div><p className="text-muted-foreground mt-2">Active Analysts</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Coverage vs Peers</CardTitle></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={coverageData} layout="vertical"><XAxis type="number" axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#a1a1aa", fontSize: 12 }} /><Tooltip contentStyle={{ backgroundColor: "#141417", border: "1px solid #27272a", borderRadius: "8px" }} /><Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
            <Card><CardHeader><CardTitle>Analyst Ratings</CardTitle></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={ratingsData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{ratingsData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex justify-center gap-4 mt-2">{ratingsData.map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-muted-foreground">{item.name}</span></div>))}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Price Targets</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between gap-4"><div className="text-center"><p className="text-sm text-muted-foreground">Low</p><p className="text-xl font-mono font-semibold text-destructive">${(stock.price * 0.7).toFixed(2)}</p></div><div className="flex-1 h-2 bg-secondary rounded-full relative"><div className="absolute h-4 w-1 bg-foreground rounded-full -top-1" style={{ left: "30%" }} /><div className="absolute h-4 w-1 bg-primary rounded-full -top-1" style={{ left: "50%" }} /></div><div className="text-center"><p className="text-sm text-muted-foreground">High</p><p className="text-xl font-mono font-semibold text-success">${(stock.price * 1.5).toFixed(2)}</p></div></div><div className="flex justify-center mt-4"><div className="text-center"><p className="text-sm text-muted-foreground">Median Target</p><p className="text-2xl font-mono font-bold">${(stock.price * 1.15).toFixed(2)}</p></div></div></CardContent></Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-2">Relative Volume</p><p className="text-4xl font-mono font-bold">{stock.avgVolume ? `${(stock.volume / stock.avgVolume).toFixed(2)}x` : "—"}</p><p className="text-sm text-muted-foreground mt-2">vs 20-day average</p></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-2">Activity Score</p><p className="text-4xl font-mono font-bold text-primary">{stock.activityScore}</p><p className="text-sm text-muted-foreground mt-2">High activity detected</p></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-2">30-Day Volatility</p><p className="text-4xl font-mono font-bold">{(Math.abs(stock.high52w - stock.low52w) / stock.price * 10).toFixed(3)}%</p><p className="text-sm text-muted-foreground mt-2">Annualized</p></div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Volume History</CardTitle><p className="text-sm text-muted-foreground">Last 30 trading days (from market data)</p></CardHeader>
            <CardContent><div className="h-64">{volumeHistoryLoading ? (<div className="h-full flex items-center justify-center text-muted-foreground">Loading volume history…</div>) : volumeHistory.length === 0 ? (<div className="h-full flex items-center justify-center text-muted-foreground">No volume history available.</div>) : (<ResponsiveContainer width="100%" height="100%"><BarChart data={volumeHistory}><XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "")} /><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} /><Tooltip contentStyle={{ backgroundColor: "#141417", border: "1px solid #27272a", borderRadius: "8px" }} labelFormatter={(v) => (v ? new Date(v).toLocaleDateString() : "")} formatter={(value: number) => [formatVolume(value), "Volume"]} /><Bar dataKey="volume" fill="#06b6d4" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}</div></CardContent>
          </Card>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Investment Hypothesis</CardTitle><p className="text-sm text-muted-foreground mt-1">AI-generated analysis based on coverage gap and market data</p></div><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Confidence:</span><Badge variant="secondary" className="font-mono">{mockHypothesis.confidence}%</Badge></div></CardHeader><CardContent><p className="text-muted-foreground leading-relaxed">{mockHypothesis.hypothesis}</p></CardContent></Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CollapsibleCard title="Bull Case" variant="bull"><ul className="space-y-2">{mockHypothesis.bullCase.points.map((point, i) => (<li key={i} className="flex gap-2 text-sm"><CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" /><span>{point}</span></li>))}</ul></CollapsibleCard>
            <CollapsibleCard title="Base Case" variant="base"><ul className="space-y-2">{mockHypothesis.baseCase.points.map((point, i) => (<li key={i} className="flex gap-2 text-sm"><Activity className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><span>{point}</span></li>))}</ul></CollapsibleCard>
            <CollapsibleCard title="Bear Case" variant="bear"><ul className="space-y-2">{mockHypothesis.bearCase.points.map((point, i) => (<li key={i} className="flex gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" /><span>{point}</span></li>))}</ul></CollapsibleCard>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Upcoming Catalysts</CardTitle></CardHeader><CardContent><div className="space-y-4">{mockHypothesis.catalysts.map((catalyst, i) => (<div key={i} className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Clock className="h-4 w-4 text-primary" /></div><div><p className="font-medium text-sm">{catalyst.event}</p><p className="text-xs text-muted-foreground">{catalyst.date}</p></div></div>))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle>Key Risks</CardTitle></CardHeader><CardContent><div className="space-y-3">{mockHypothesis.risks.map((risk, i) => (<div key={i} className="flex items-center justify-between"><span className="text-sm">{risk.risk}</span><Badge variant="outline" className={risk.severity === "high" ? "border-destructive/50 text-destructive" : risk.severity === "medium" ? "border-warning/50 text-warning" : "border-muted-foreground/50 text-muted-foreground"}>{risk.severity}</Badge></div>))}</div></CardContent></Card>
          </div>
          <div className="flex justify-center"><Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><RefreshCw className="h-4 w-4" />Regenerate Analysis</Button></div>
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="space-y-6">
          <Card><CardHeader><CardTitle>Latest News</CardTitle><p className="text-sm text-muted-foreground">Top 5 recent articles for {stock.ticker} powered by Finnhub.</p></CardHeader><CardContent>{newsLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading news…</div>}{!newsLoading && newsError && <div className="text-sm text-destructive py-4 text-center">{newsError}</div>}{!newsLoading && !newsError && news.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">No recent news found for this ticker.</div>}<div className="space-y-4">{news.map((item) => { const date = new Date(item.datetime * 1000); return (<div key={item.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border/60 hover:bg-secondary/50 transition-colors"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs uppercase tracking-wide text-primary font-semibold">{item.source}</span><span className="text-xs text-muted-foreground">{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div><a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:text-primary line-clamp-2">{item.headline}</a>{item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.summary}</p>}</div><a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a></div>) })}</div></CardContent></Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card><CardHeader><CardTitle>SEC Filings</CardTitle><p className="text-sm text-muted-foreground">Links open on SEC EDGAR. 10-K, 10-Q, and 8-K filings for {stock.ticker}.</p></CardHeader><CardContent>{secFilingsLoading ? (<div className="py-8 text-center text-muted-foreground">Loading SEC filings…</div>) : secFilingsError ? (<div className="py-4 text-sm text-destructive">{secFilingsError}</div>) : secFilings.length === 0 ? (<div className="py-8 text-center text-muted-foreground">No SEC filings found for this ticker.</div>) : (<div className="space-y-2">{secFilings.map((doc, i) => (<a key={`${doc.type}-${doc.date}-${i}`} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group"><div className="flex items-center gap-3"><Badge variant="outline" className={doc.type === "10-K" ? "border-primary/50 text-primary" : doc.type === "10-Q" ? "border-cyan/50 text-cyan" : "border-warning/50 text-warning"}>{doc.type}</Badge><div><p className="font-medium text-sm">{doc.title}</p><p className="text-xs text-muted-foreground">{doc.date}</p></div></div><ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></a>))}</div>)}</CardContent></Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>RAG Research Assistant</CardTitle>
              <p className="text-sm text-muted-foreground">Ask questions about {stock.ticker} and get AI-powered answers</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {chatMessages.map((message, i) => (
                  <ChatBubble key={i} role={message.role} content={message.content} />
                ))}
                {chatSending && <ThinkingBubble />}
                <div ref={chatEndRef} />
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {["Why is this stock under-covered?", "What are the main risks?", "Compare to sector peers"].map((question) => (
                  <Button key={question} variant="outline" size="sm" onClick={() => setChatInput(question)} className="text-xs">{question}</Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={chatSending} placeholder="Ask about this stock..." onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} />
                <Button onClick={handleSendMessage} disabled={chatSending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {chatSending ? (<div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />) : (<Send className="h-4 w-4" />)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}