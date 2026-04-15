"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"
import {
  Tooltip as RechartsTooltip,
} from "recharts"

type QuintileResult = {
  eval_date: string
  forward_days: number
  quintile: number
  stock_count: number
  avg_gap_score: number
  avg_return: number
  median_return: number
  hit_rate: number
  best_ticker: string
  best_return: number
  worst_ticker: string
  worst_return: number
}

type BacktestSummary = {
  id: number
  run_date: string
  eval_dates_used: string
  total_stocks: number
  forward_days: number
  q1_avg_return: number
  q5_avg_return: number
  q1_q5_spread: number
  q1_hit_rate: number
  spearman_corr: number
  benchmark_return: number | null
  q1_alpha: number | null
  signal_is_valid: boolean
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  variant?: "default" | "success" | "danger" | "primary"
}) {
  const variants = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-destructive",
    primary: "text-primary",
  }
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={`text-2xl font-bold font-mono ${variants[variant]}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuintileBarChart({ data, forwardDays }: { data: QuintileResult[]; forwardDays: number }) {
  const filtered = data.filter((d) => d.forward_days === forwardDays)

  // Aggregate across eval dates: average the avg_return per quintile
  const quintileAgg = useMemo(() => {
    const groups: Record<number, { returns: number[]; gapScores: number[]; hitRates: number[] }> = {}
    for (const r of filtered) {
      if (!groups[r.quintile]) groups[r.quintile] = { returns: [], gapScores: [], hitRates: [] }
      groups[r.quintile].returns.push(r.avg_return)
      groups[r.quintile].gapScores.push(r.avg_gap_score)
      groups[r.quintile].hitRates.push(r.hit_rate)
    }

    return Object.entries(groups)
      .map(([q, vals]) => ({
        quintile: `Q${q}`,
        quintileNum: Number(q),
        avgReturn: vals.returns.reduce((s, v) => s + v, 0) / vals.returns.length,
        avgGapScore: vals.gapScores.reduce((s, v) => s + v, 0) / vals.gapScores.length,
        hitRate: vals.hitRates.reduce((s, v) => s + v, 0) / vals.hitRates.length,
      }))
      .sort((a, b) => a.quintileNum - b.quintileNum)
  }, [filtered])

  if (quintileAgg.length === 0) return null

  const colors = ["#22C55E", "#4ADE80", "#94A3B8", "#F87171", "#EF4444"]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {forwardDays}-Day Forward Returns by Quintile
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Q1 = highest gap scores, Q5 = lowest. A descending staircase = signal works.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quintileAgg} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="quintile"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "Avg Return"]}
              />
              <Bar dataKey="avgReturn" radius={[4, 4, 0, 0]}>
                {quintileAgg.map((_, idx) => (
                  <Cell key={idx} fill={colors[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quintile detail table */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {quintileAgg.map((q, i) => (
            <div
              key={q.quintile}
              className="text-center p-2 rounded-lg border border-border/50 bg-muted/30"
            >
              <div className="text-xs font-medium text-muted-foreground">{q.quintile}</div>
              <div className={`text-sm font-bold font-mono ${q.avgReturn >= 0 ? "text-success" : "text-destructive"}`}>
                {(q.avgReturn * 100).toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Gap: {q.avgGapScore.toFixed(0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Hit: {(q.hitRate * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SignalDecayChart({ summaries }: { summaries: BacktestSummary[] }) {
  const chartData = useMemo(() => {
    // Group by forward_days, take the latest run per horizon
    const byHorizon: Record<number, BacktestSummary> = {}
    for (const s of summaries) {
      const fd = s.forward_days
      if (!byHorizon[fd] || s.run_date > byHorizon[fd].run_date) {
        byHorizon[fd] = s
      }
    }

    return Object.values(byHorizon)
      .sort((a, b) => a.forward_days - b.forward_days)
      .map((s) => ({
        horizon: `${s.forward_days}d`,
        days: s.forward_days,
        spread: s.q1_q5_spread * 100,
        spearman: s.spearman_corr,
        hitRate: s.q1_hit_rate * 100,
      }))
  }, [summaries])

  if (chartData.length < 2) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Signal Decay — Performance by Horizon
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          How the gap score signal strength changes across different forward-looking windows.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="horizon"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="spread"
                stroke="#22C55E"
                strokeWidth={2}
                name="Q1-Q5 Spread %"
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spearman"
                stroke="#14B8A6"
                strokeWidth={2}
                name="Spearman Corr"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BacktestPage() {
  const [summaries, setSummaries] = useState<BacktestSummary[]>([])
  const [quintileResults, setQuintileResults] = useState<QuintileResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedHorizon, setSelectedHorizon] = useState(30)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/backtest")
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      }
      setSummaries(data.summaries || [])
      setQuintileResults(data.quintileResults || [])
    } catch {
      setError("Failed to load backtest data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Get the latest summary per horizon
  const latestSummaries = useMemo(() => {
    const byHorizon: Record<number, BacktestSummary> = {}
    for (const s of summaries) {
      if (!byHorizon[s.forward_days] || s.run_date > byHorizon[s.forward_days].run_date) {
        byHorizon[s.forward_days] = s
      }
    }
    return byHorizon
  }, [summaries])

  const activeSummary = latestSummaries[selectedHorizon]
  const availableHorizons = Object.keys(latestSummaries).map(Number).sort((a, b) => a - b)
  const hasData = summaries.length > 0 || quintileResults.length > 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Signal Validation</h1>
            <p className="text-muted-foreground">
              Validating gap score predictive power with historical returns
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && !hasData && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Validation Results Yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Run the backtest engine to validate whether your gap scores predict stock returns.
              This requires historical score data from the daily pipeline.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto text-left">
              <p className="text-sm font-mono text-muted-foreground mb-2">
                Run the backtest:
              </p>
              <code className="text-sm font-mono text-primary block">
                python scripts/backtest_engine.py
              </code>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && hasData && (
        <div className="space-y-6">
          {/* Horizon selector */}
          {availableHorizons.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Forward horizon:</span>
              {availableHorizons.map((h) => (
                <Button
                  key={h}
                  variant={selectedHorizon === h ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedHorizon(h)}
                >
                  {h} days
                </Button>
              ))}
            </div>
          )}

          {/* Summary metrics */}
          {activeSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Q1-Q5 Spread"
                value={`${(activeSummary.q1_q5_spread * 100).toFixed(2)}%`}
                subtitle={activeSummary.q1_q5_spread > 0 ? "High scores outperform" : "Signal is weak"}
                icon={activeSummary.q1_q5_spread > 0 ? TrendingUp : TrendingDown}
                variant={activeSummary.q1_q5_spread > 0 ? "success" : "danger"}
              />
              <MetricCard
                title="Spearman Correlation"
                value={activeSummary.spearman_corr.toFixed(4)}
                subtitle="Score vs return rank correlation"
                icon={BarChart3}
                variant={activeSummary.spearman_corr > 0 ? "primary" : "danger"}
              />
              <MetricCard
                title="Q1 Hit Rate"
                value={`${(activeSummary.q1_hit_rate * 100).toFixed(1)}%`}
                subtitle="Top quintile beating median"
                icon={Activity}
                variant={activeSummary.q1_hit_rate > 0.5 ? "success" : "danger"}
              />
              <MetricCard
                title="Signal Valid"
                value={activeSummary.signal_is_valid ? "YES" : "NO"}
                subtitle={`${activeSummary.total_stocks} stocks evaluated`}
                icon={activeSummary.signal_is_valid ? CheckCircle : XCircle}
                variant={activeSummary.signal_is_valid ? "success" : "danger"}
              />
            </div>
          )}

          {/* Q1 and Q5 return comparison */}
          {activeSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-success/20 bg-success/[0.03]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Q1 — Top Gap Scores</span>
                    <Badge variant="secondary" className="text-[10px]">Top 20%</Badge>
                  </div>
                  <p className="text-3xl font-bold font-mono text-success">
                    {(activeSummary.q1_avg_return * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average {selectedHorizon}-day forward return
                  </p>
                </CardContent>
              </Card>
              <Card className="border-destructive/20 bg-destructive/[0.03]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Q5 — Lowest Gap Scores</span>
                    <Badge variant="secondary" className="text-[10px]">Bottom 20%</Badge>
                  </div>
                  <p className="text-3xl font-bold font-mono text-destructive">
                    {(activeSummary.q5_avg_return * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average {selectedHorizon}-day forward return
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quintile bar chart */}
          <QuintileBarChart data={quintileResults} forwardDays={selectedHorizon} />

          {/* Signal decay chart */}
          <SignalDecayChart summaries={summaries} />

          {/* Methodology note */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Methodology</p>
                  <p>
                    Stocks are ranked by gap score into quintiles (Q1 = top 20%, Q5 = bottom 20%).
                    Forward returns are computed from actual market closing prices.
                    A positive Q1-Q5 spread means high gap scores predict higher future returns.
                    Spearman correlation measures the monotonic relationship between gap score rank
                    and return rank. Hit rate is the percentage of Q1 stocks that outperform the median.
                  </p>
                  {activeSummary?.eval_dates_used && (
                    <p className="text-xs mt-2">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Evaluated across: {activeSummary.eval_dates_used}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
