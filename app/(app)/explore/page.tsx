"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare,
  Search,
  Send,
  ArrowRight,
  Sparkles,
  Filter,
  History,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
import { formatMarketCap, formatPercent } from "@/lib/mock-data"
import { sendChatMessage, sendChatMessageStream } from "@/lib/rag-chat"
import { ChatBubble, ThinkingBubble } from "@/components/chat-bubble"

type ChatMessage = { role: "user" | "assistant"; content: string; hasWebSources?: boolean }

export default function ExplorePage() {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [mode, setMode] = useState<"ticker" | "global">("ticker")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Scroll only the chat container, not the whole page
  useEffect(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  useEffect(() => {
    fetchOpportunities()
      .then((data) => {
        setOpportunities(data)
        if (data.length > 0) {
          setSelectedTicker(data[0].ticker)
          setMessages([
            {
              role: "assistant",
              content:
                "Welcome to VOID AI Explore. Pick a stock on the left or ask a global question about under‑covered opportunities. I am your Analyst Copilot.",
            },
          ])
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load opportunities"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return opportunities
      .filter(
        (o) =>
          o.ticker.toLowerCase().includes(q) ||
          o.company.toLowerCase().includes(q) ||
          o.sector.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [opportunities, search])

  const active = selectedTicker
    ? opportunities.find((o) => o.ticker === selectedTicker) ?? null
    : null

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setSending(true)

    // Add empty assistant message that will fill in
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    const history = messages
      .filter((_, i) => i > 0)
      .map((m) => ({ role: m.role, content: m.content }))

    const ticker = mode === "ticker" && active ? active.ticker : null
    const companyName = mode === "ticker" && active ? active.company : null

    await sendChatMessageStream(
      text,
      ticker,
      companyName,
      history,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: updated[lastIndex].content + token
          }
          return updated
        })
      },
      (sources) => {
        const hasWeb = sources.some((s) => s.source_type === "web")
        if (hasWeb) {
          setMessages((prev) => {
            const updated = [...prev]
            const lastIndex = updated.length - 1
            updated[lastIndex] = { ...updated[lastIndex], hasWebSources: true }
            return updated
          })
        }
      },
      () => {
        setSending(false)
      },
      (error) => {
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: `Sorry, I encountered an error: ${error}. Please try again.`
          }
          return updated
        })
        setSending(false)
      }
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Explore &amp; Chat</h1>
        <p className="text-muted-foreground">Loading opportunities…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Explore &amp; Chat</h1>
        <p className="text-muted-foreground mb-4">Error loading data</p>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    )
  }

  const showLeft = mode === "ticker"
  const chatCols = showLeft ? "lg:col-span-2" : "lg:col-span-3"

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Explore &amp; Chat
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive research workspace powered by VOID AI scores and SEC filings.
          </p>
        </div>
        {active && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex gap-2"
            onClick={() => router.push(`/stock/${active.ticker}`)}
          >
            View {active.ticker} detail
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Ticker list */}
        {showLeft && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Top Opportunities</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {opportunities.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ticker, name, sector..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Top 50 by gap score</span>
                <span className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {filtered.length} shown
                </span>
              </div>
              <div className="max-h-[520px] overflow-y-auto space-y-1">
                {filtered.map((o) => {
                  const isActive = o.ticker === selectedTicker
                  return (
                    <button
                      key={o.ticker}
                      onClick={() => {
                        setSelectedTicker(o.ticker)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 hover:bg-secondary/60"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{o.ticker}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {o.sector}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {o.company}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs">
                            {formatMarketCap(o.marketCap)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Gap {o.gapScore} · Act {o.activityScore}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    No stocks match your search.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Right: Chat */}
        <Card className={`${chatCols} h-[640px] flex flex-col`}>
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Analyst Copilot
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ask focused questions about a selected ticker, or switch to global mode for
                cross‑universe questions.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="relative inline-flex rounded-full border border-border bg-background p-0.5 text-xs">
                {/* sliding pill — uses left-1/2 / right-1/2 with flex-1 buttons so 50% = exact midpoint */}
                <span
                  className={`absolute inset-y-0.5 rounded-full bg-primary transition-[left,right] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    mode === "ticker" ? "left-0.5 right-1/2" : "left-1/2 right-0.5"
                  }`}
                />
                <button
                  className={`relative z-10 flex-1 px-4 py-1 text-center transition-colors duration-300 ${
                    mode === "ticker" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMode("ticker")}
                >
                  Focused on ticker
                </button>
                <button
                  className={`relative z-10 flex-1 px-4 py-1 text-center transition-colors duration-300 ${
                    mode === "global" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMode("global")}
                >
                  Global
                </button>
              </div>
              <div
                className={`text-xs text-muted-foreground overflow-hidden transition-all duration-300 ease-in-out ${
                  mode === "ticker" && active ? "max-h-8 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                Context: <span className="font-mono">{active?.ticker}</span> ·{" "}
                {active?.company}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0 min-h-0">
            {/* Chat history summary */}
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <History className="h-3 w-3" />
              <span>Chat history in this session:</span>
              <div className="flex flex-wrap gap-1">
                {messages
                  .filter((m) => m.role === "user")
                  .map((m, idx) => (
                    <button
                      key={idx}
                      className="px-2 py-0.5 rounded-full border border-border bg-background hover:bg-secondary/80 max-w-[180px] truncate"
                      title={m.content}
                      onClick={() => setInput(m.content)}
                    >
                      {m.content}
                    </button>
                  ))}
                {messages.filter((m) => m.role === "user").length === 0 && (
                  <span>No questions yet.</span>
                )}
              </div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
              {messages.map((m, idx) => (
                <ChatBubble key={idx} role={m.role} content={m.content} hasWebSources={m.hasWebSources} />
              ))}
              {sending && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && <ThinkingBubble />}
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Start by selecting a ticker on the left or asking a question here.
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div key={mode} className="mb-3 flex flex-wrap gap-2 animate-in fade-in duration-300">
              {(mode === "ticker"
                ? [
                    "Summarize this company's business model",
                    "Why is this stock under‑covered?",
                    "What are key risks in the latest 10‑K?",
                  ]
                : [
                    "Which stocks have the widest coverage gap?",
                    "Compare earnings beats across under‑covered stocks",
                    "What sectors are most under‑covered?",
                  ]
              ).map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setInput(q)}
                >
                  {q}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                placeholder={
                  mode === "ticker"
                    ? "Ask a question about the selected stock..."
                    : "Ask a global question across all under‑covered stocks..."
                }
                className="min-h-[60px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button onClick={handleSend} disabled={sending} className="h-10 w-10 rounded-full">
                {sending ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {active && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Current scores · Gap {active.gapScore} · Activity {active.activityScore} ·{" "}
                Analysts {active.analystCount} · {formatPercent(active.changePercent)} today.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}