"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  Briefcase,
  Globe,
  Brain,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  ChevronDown,
  ChevronRight,
  Send,
  MessageSquare,
  Sparkles,
  X,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  getAnalysis,
  generateAnalysisStream,
  type AnalysisData,
  type StreamingTask,
} from "@/lib/analysis-api"
import {
  sendChatMessageStream,
  type ChatMessage,
  type SourceDocument,
} from "@/lib/rag-chat"
import { DebateTranscript } from "@/components/debate-transcript"
import { ChatBubble, ThinkingBubble } from "@/components/chat-bubble"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockDBInfo {
  company: string
  sector: string
  gapScore: number
  analystCount: number
}

interface PortfolioRow {
  ticker: string
  dbInfo: StockDBInfo | null    // null = external / not in DB
  dbLoading: boolean
  analysis: AnalysisData | null
  analysisLoading: boolean
  streamingTasks: StreamingTask[]
  isStreaming: boolean
  analysisError: string | null
  isExpanded: boolean
}

// ─── Agent styling helpers ─────────────────────────────────────────────────────

const agentStyle: Record<string, { color: string; bg: string }> = {
  "Bull Analyst":                    { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  "Bear Analyst":                    { color: "text-red-400",     bg: "bg-red-400/10 border-red-400/20"     },
  "Fundamental Research Analyst":    { color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20"   },
  "Debate Moderator":                { color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/20" },
  "Investment Strategist":           { color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/20" },
}

function AgentIcon({ agent }: { agent: string }) {
  if (agent.includes("Bull"))        return <TrendingUp  className="w-3 h-3" />
  if (agent.includes("Bear"))        return <TrendingDown className="w-3 h-3" />
  if (agent.includes("Fundamental")) return <BarChart3   className="w-3 h-3" />
  if (agent.includes("Moderator"))   return <Users       className="w-3 h-3" />
  return <Brain className="w-3 h-3" />
}

// ─── Parse tickers from freeform text ─────────────────────────────────────────

function parseTickers(raw: string): string[] {
  const tokens = raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s,;\n]/g, " ")
    .split(/[\s,;\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && t.length <= 5 && /^[A-Z]+$/.test(t))
  return [...new Set(tokens)]
}

// ─── Confidence badge color ────────────────────────────────────────────────────

function confidenceColor(c: number) {
  if (c >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
  if (c >= 45) return "bg-amber-500/15 text-amber-400 border-amber-500/30"
  return "bg-red-500/15 text-red-400 border-red-500/30"
}

// ─── Live streaming task card ──────────────────────────────────────────────────

function LiveTaskCard({ task, isLatest }: { task: StreamingTask; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const style = agentStyle[task.agent] || { color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" }

  return (
    <div
      className={`rounded-md border ${style.bg} p-2.5 transition-all duration-500 ${
        isLatest ? "animate-in fade-in slide-in-from-bottom-2" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono text-muted-foreground">T{task.taskIndex}/9</span>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.color}`}>
          <AgentIcon agent={task.agent} />
          {task.agent}
        </span>
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed">
        {expanded ? task.output : task.summary}
      </p>
      {task.output && task.output !== task.summary && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
        >
          {expanded ? "Show less" : "Show full output"}
        </button>
      )}
    </div>
  )
}

// ─── Expanded analysis panel ───────────────────────────────────────────────────

function AnalysisPanel({ analysis }: { analysis: AnalysisData }) {
  return (
    <div className="space-y-4 pt-2">
      {/* Hypothesis */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">Investment Hypothesis</p>
        <p className="text-sm text-foreground/80 leading-relaxed">{analysis.hypothesis}</p>
      </div>

      {/* Bull / Bear / Base */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Bull */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Bull Case
          </p>
          <ul className="space-y-1">
            {analysis.bullCase.points.slice(0, 4).map((pt, i) => (
              <li key={i} className="text-xs text-foreground/70 flex gap-1.5">
                <span className="text-emerald-400 mt-0.5">•</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
        {/* Bear */}
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Bear Case
          </p>
          <ul className="space-y-1">
            {analysis.bearCase.points.slice(0, 4).map((pt, i) => (
              <li key={i} className="text-xs text-foreground/70 flex gap-1.5">
                <span className="text-red-400 mt-0.5">•</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
        {/* Risks */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Key Risks
          </p>
          <ul className="space-y-1">
            {analysis.risks.slice(0, 4).map((r, i) => (
              <li key={i} className="text-xs text-foreground/70 flex gap-1.5">
                <span className={r.severity === "high" ? "text-red-400" : r.severity === "medium" ? "text-amber-400" : "text-blue-400"}>•</span>
                {r.risk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Full debate transcript */}
      <DebateTranscript
        steps={analysis.debateTranscript}
        newsContext={analysis.newsContext}
        generatedAt={analysis.generatedAt}
        modelUsed={analysis.modelUsed}
      />
    </div>
  )
}

// ─── Portfolio Table Row ───────────────────────────────────────────────────────

interface RowProps {
  row: PortfolioRow
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onGenerateAnalysis: () => void
  onToggleExpand: () => void
}

function PortfolioTableRow({ row, isSelected, onSelect, onRemove, onGenerateAnalysis, onToggleExpand }: RowProps) {
  const isExternal = row.dbInfo === null && !row.dbLoading

  return (
    <div className="border-b border-border/40 last:border-b-0">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/20 ${
          isSelected ? "bg-primary/5" : ""
        }`}
        onClick={onSelect}
      >
        {/* Ticker + company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">{row.ticker}</span>

            {row.dbLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
            )}

            {!row.dbLoading && row.dbInfo && (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {row.dbInfo.company}
              </span>
            )}

            {/* External badge */}
            {isExternal && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan/10 text-cyan border border-cyan/30">
                <Globe className="w-3 h-3" />
                Live Web Search
              </span>
            )}
          </div>

          {/* Sector / metadata badges */}
          {!row.dbLoading && row.dbInfo && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] text-muted-foreground">{row.dbInfo.sector}</span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">
                {row.dbInfo.analystCount} analyst{row.dbInfo.analystCount !== 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">Gap {row.dbInfo.gapScore}</span>
            </div>
          )}
        </div>

        {/* Right side: analysis status + actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Confidence badge */}
          {row.analysis && !row.isStreaming && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(row.analysis.confidence)}`}
            >
              <CheckCircle className="w-3 h-3" />
              {row.analysis.confidence}% Confidence
            </span>
          )}

          {/* Streaming indicator */}
          {row.isStreaming && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Analyzing…
            </span>
          )}

          {/* Generate button */}
          {!row.analysis && !row.analysisLoading && !row.isStreaming && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onGenerateAnalysis}
            >
              <Sparkles className="w-3 h-3" />
              Generate Analysis
            </Button>
          )}

          {/* Loading spinner (initial fetch) */}
          {row.analysisLoading && !row.isStreaming && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Checking…
            </span>
          )}

          {/* Error */}
          {row.analysisError && !row.isStreaming && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive gap-1"
              onClick={onGenerateAnalysis}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          )}

          {/* Expand chevron */}
          {(row.analysis || row.streamingTasks.length > 0) && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onToggleExpand}
            >
              {row.isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Remove */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded area: streaming feed or full analysis */}
      {row.isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/20 bg-muted/10">
          {/* Streaming live feed */}
          {row.isStreaming && row.streamingTasks.length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">
                Live Agent Debate Feed
              </p>
              {row.streamingTasks.map((task, i) => (
                <LiveTaskCard
                  key={i}
                  task={task}
                  isLatest={i === row.streamingTasks.length - 1}
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Agents are deliberating…</span>
              </div>
            </div>
          )}

          {/* Completed analysis */}
          {row.analysis && !row.isStreaming && (
            <AnalysisPanel analysis={row.analysis} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Chat Sidebar ──────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  focusTicker: string | null
  focusCompany: string | null
}

function ChatSidebar({ focusTicker, focusCompany }: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sources, setSources] = useState<SourceDocument[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset chat when ticker changes
  useEffect(() => {
    setMessages(
      focusTicker
        ? [
            {
              role: "assistant",
              content: `I'm now focused on **${focusTicker}**${focusCompany ? ` (${focusCompany})` : ""}. Ask me anything about this stock — the investment thesis, risks, what the bear agent said, or how it compares to the market.`,
            },
          ]
        : [
            {
              role: "assistant",
              content: "Select a stock from your portfolio to start a focused conversation. I'll answer questions about its thesis, risks, and agent debate.",
            },
          ]
    )
    setSources([])
  }, [focusTicker])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isSending) return

    setInput("")
    setIsSending(true)
    setSources([])

    const userMsg: ChatMessage = { role: "user", content: text }
    const history = [...messages, userMsg]
    setMessages(history)

    let assistantContent = ""
    const assistantIdx = history.length

    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    await sendChatMessageStream(
      text,
      focusTicker,
      focusCompany,
      messages,
      (token) => {
        assistantContent += token
        setMessages((prev) => {
          const updated = [...prev]
          updated[assistantIdx] = { role: "assistant", content: assistantContent }
          return updated
        })
      },
      (srcs) => setSources(srcs),
      () => setIsSending(false),
      (err) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[assistantIdx] = {
            role: "assistant",
            content: `Sorry, I ran into an error: ${err}`,
          }
          return updated
        })
        setIsSending(false)
      }
    )
  }, [input, isSending, messages, focusTicker, focusCompany])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasWebSources = sources.some((s) => s.source_type === "web")

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {focusTicker ? (
              <>
                Chat:{" "}
                <span className="text-primary font-mono">{focusTicker}</span>
              </>
            ) : (
              "AI Chat"
            )}
          </span>
        </div>
        {focusTicker && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Focused on {focusCompany || focusTicker} · Click another stock to switch
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            role={msg.role}
            content={msg.content}
            hasWebSources={msg.role === "assistant" && i === messages.length - 1 && hasWebSources}
          />
        ))}
        {isSending && messages[messages.length - 1]?.content === "" && <ThinkingBubble />}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/40 shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              focusTicker
                ? `Ask about ${focusTicker}…`
                : "Select a stock to chat…"
            }
            disabled={isSending || !focusTicker}
            className="flex-1 h-9 text-sm bg-secondary border-none"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={isSending || !input.trim() || !focusTicker}
            onClick={sendMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [tickerInput, setTickerInput] = useState("")
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const debateFeedRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // ── Load stock info from DB + cached analysis ──────────────────────────────

  const loadStock = useCallback(async (ticker: string) => {
    // Fetch DB info
    const [dbRes, analysisRes] = await Promise.allSettled([
      fetch(`/api/stock/${ticker}`).then((r) => (r.ok ? r.json() : null)),
      getAnalysis(ticker),
    ])

    const dbData = dbRes.status === "fulfilled" ? dbRes.value : null
    const analysis = analysisRes.status === "fulfilled" ? analysisRes.value : null

    setPortfolio((prev) =>
      prev.map((row) =>
        row.ticker === ticker
          ? {
              ...row,
              dbLoading: false,
              dbInfo: dbData
                ? {
                    company: dbData.name ?? ticker,
                    sector: dbData.sector ?? "Unknown",
                    gapScore: Math.round(dbData.gap_score ?? 0),
                    analystCount: dbData.analyst_count ?? 0,
                  }
                : null,
              analysis,
              analysisLoading: false,
            }
          : row
      )
    )
  }, [])

  // ── Add tickers from input ──────────────────────────────────────────────────

  const handleLoadPortfolio = () => {
    const tickers = parseTickers(tickerInput)
    if (!tickers.length) return

    setPortfolio((prev) => {
      const existing = new Set(prev.map((r) => r.ticker))
      const newRows: PortfolioRow[] = tickers
        .filter((t) => !existing.has(t))
        .map((t) => ({
          ticker: t,
          dbInfo: null,
          dbLoading: true,
          analysis: null,
          analysisLoading: true,
          streamingTasks: [],
          isStreaming: false,
          analysisError: null,
          isExpanded: false,
        }))
      return [...prev, ...newRows]
    })

    setTickerInput("")

    // Kick off loading for each new ticker
    tickers.forEach((t) => {
      setPortfolio((prev) => {
        if (prev.some((r) => r.ticker === t)) {
          loadStock(t)
        }
        return prev
      })
    })

    // Schedule loads after state is flushed
    setTimeout(() => {
      tickers.forEach((t) => loadStock(t))
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleLoadPortfolio()
    }
  }

  // ── Generate analysis with streaming ───────────────────────────────────────

  const handleGenerateAnalysis = (ticker: string) => {
    setPortfolio((prev) =>
      prev.map((row) =>
        row.ticker === ticker
          ? { ...row, isStreaming: true, streamingTasks: [], analysisError: null, isExpanded: true }
          : row
      )
    )

    generateAnalysisStream(
      ticker,
      false,
      // onTask
      (task) => {
        setPortfolio((prev) =>
          prev.map((row) =>
            row.ticker === ticker
              ? { ...row, streamingTasks: [...row.streamingTasks, task] }
              : row
          )
        )
        // Auto-scroll the debate feed
        const el = debateFeedRefs.current[ticker]
        if (el) el.scrollTop = el.scrollHeight
      },
      // onAnalysis
      (analysis) => {
        setPortfolio((prev) =>
          prev.map((row) =>
            row.ticker === ticker
              ? { ...row, analysis, isStreaming: false }
              : row
          )
        )
      },
      // onDone
      () => {
        setPortfolio((prev) =>
          prev.map((row) =>
            row.ticker === ticker
              ? { ...row, isStreaming: false }
              : row
          )
        )
      },
      // onError
      (err) => {
        setPortfolio((prev) =>
          prev.map((row) =>
            row.ticker === ticker
              ? { ...row, isStreaming: false, analysisError: err }
              : row
          )
        )
      }
    )
  }

  // ── Remove a row ────────────────────────────────────────────────────────────

  const removeStock = (ticker: string) => {
    setPortfolio((prev) => prev.filter((r) => r.ticker !== ticker))
    if (selectedTicker === ticker) setSelectedTicker(null)
  }

  // ── Toggle expanded ─────────────────────────────────────────────────────────

  const toggleExpand = (ticker: string) => {
    setPortfolio((prev) =>
      prev.map((row) =>
        row.ticker === ticker ? { ...row, isExpanded: !row.isExpanded } : row
      )
    )
  }

  // ── Derived: selected row info for chat ────────────────────────────────────

  const selectedRow = portfolio.find((r) => r.ticker === selectedTicker) ?? null

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left: portfolio area ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-5 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <Briefcase className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold">My Stocks</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste any tickers to load your portfolio and run AI analysis — even stocks outside our database.
          </p>
        </div>

        {/* Ticker input */}
        <div className="px-6 py-4 border-b border-border/40 shrink-0 bg-muted/20">
          <div className="flex gap-3 items-start max-w-2xl">
            <div className="flex-1">
              <Textarea
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste tickers: KODK, AAPL TSLA&#10;NVDA MSFT (any format, comma or space separated)"
                className="resize-none h-16 text-sm font-mono bg-background border-border/60 placeholder:font-sans"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Press Enter or click Load · Stocks outside our universe get a{" "}
                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-cyan/10 text-cyan border border-cyan/30">
                  <Globe className="w-2.5 h-2.5" /> Live Web Search
                </span>{" "}
                badge — agents can still analyze them via the web.
              </p>
            </div>
            <Button
              onClick={handleLoadPortfolio}
              disabled={!tickerInput.trim()}
              className="mt-0.5 gap-2 shrink-0"
            >
              <Briefcase className="w-4 h-4" />
              Load
            </Button>
          </div>
        </div>

        {/* Portfolio table */}
        <div className="flex-1 overflow-y-auto">
          {portfolio.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Briefcase className="w-7 h-7 text-primary/60" />
              </div>
              <h3 className="text-base font-semibold mb-1">Your portfolio is empty</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Paste a list of ticker symbols above to get started. You can add stocks from any
                exchange — our AI agents will research them using web search.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 sticky top-0 z-10">
                <span className="text-xs font-medium text-muted-foreground flex-1">
                  TICKER / COMPANY
                </span>
                <span className="text-xs font-medium text-muted-foreground shrink-0 mr-2">
                  ANALYSIS STATUS
                </span>
              </div>

              {/* Rows */}
              {portfolio.map((row) => (
                <PortfolioTableRow
                  key={row.ticker}
                  row={row}
                  isSelected={selectedTicker === row.ticker}
                  onSelect={() =>
                    setSelectedTicker(
                      selectedTicker === row.ticker ? null : row.ticker
                    )
                  }
                  onRemove={() => removeStock(row.ticker)}
                  onGenerateAnalysis={() => handleGenerateAnalysis(row.ticker)}
                  onToggleExpand={() => toggleExpand(row.ticker)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: chat sidebar ──────────────────────────────────────── */}
      <div className="w-80 xl:w-96 border-l border-border/40 shrink-0 flex flex-col overflow-hidden bg-card/30">
        <ChatSidebar
          focusTicker={selectedRow?.ticker ?? null}
          focusCompany={selectedRow?.dbInfo?.company ?? null}
        />
      </div>
    </div>
  )
}
