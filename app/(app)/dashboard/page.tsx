"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Eye,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatMarketCap, formatPercent } from "@/lib/mock-data"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
import { fetchUserAlerts, type Alert as UserAlert } from "@/lib/alerts-api"
import { getRelativeTime } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

// Summary stats are computed from real data in the component

// Trend data length by range (used in component via useMemo)
const getTrendLength = (range: string) =>
  range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 12

const MARKET_CAP_BUCKETS = ["Micro", "Small", "Mid", "Large"] as const

/** USD thresholds: under $300M, $300M–$2B, $2B–$10B, $10B+ */
function capBucketUsd(marketCap: number): (typeof MARKET_CAP_BUCKETS)[number] {
  if (!Number.isFinite(marketCap) || marketCap <= 0) return "Micro"
  if (marketCap < 300e6) return "Micro"
  if (marketCap < 2e9) return "Small"
  if (marketCap < 10e9) return "Mid"
  return "Large"
}

function medianPositive(values: number[]): number {
  const nums = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (nums.length === 0) return 0
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 ? nums[mid]! : (nums[mid - 1]! + nums[mid]!) / 2
}

const GAP_SCORE_INFO =
  "Combined score (0–100) measuring how under-covered a stock is vs. peers, based on analyst coverage, trading activity, and quality. Higher = stronger opportunity."

function SummaryCard({
  title,
  value,
  icon: Icon,
  change,
  trend,
  highlight,
  infoTooltip,
}: {
  title: string
  value: string
  icon: React.ElementType
  change: string
  trend: string
  highlight?: boolean
  infoTooltip?: string
}) {
  return (
    <Card
      className={`${highlight ? "border-primary bg-primary/5" : ""} transition-all hover:shadow-md hover:-translate-y-0.5`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className={`h-5 w-5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div
            className={`flex items-center gap-1 text-sm ${trend === "up" ? "text-success" : "text-destructive"}`}
          >
            {trend === "up" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {change}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            {title}
            {infoTooltip && (
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex text-muted-foreground hover:text-foreground cursor-help" aria-label="What does this mean?">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left">
                  {infoTooltip}
                </TooltipContent>
              </UITooltip>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ index, value }))
  const isPositive = data[data.length - 1] >= data[0]

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={isPositive ? "#10b981" : "#ef4444"}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function OpportunityTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "High Priority": "bg-primary/10 text-primary border-primary/20",
    "Strong Opportunity": "bg-success/10 text-success border-success/20",
    "Moderate Opportunity": "bg-warning/10 text-warning border-warning/20",
    "Low Priority": "bg-muted/50 text-muted-foreground border-muted",
    "High Activity Low Coverage": "bg-primary/10 text-primary border-primary/20",
    "Emerging Coverage Gap": "bg-warning/10 text-warning border-warning/20",
    "Institutional Blind Spot": "bg-warning/10 text-warning border-warning/20",
    "Sector Mispricing": "bg-success/10 text-success border-success/20",
  }

  return (
    <Badge variant="outline" className={`text-xs ${colors[type] || ""}`}>
      {type.split(" ").slice(0, 2).join(" ")}
    </Badge>
  )
}

function AlertTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    gap_increase: { color: "text-primary", icon: TrendingUp },
    volume_spike: { color: "text-cyan", icon: Activity },
    new_opportunity: { color: "text-success", icon: Eye },
    coverage_change: { color: "text-warning", icon: BarChart3 },
    price_movement: { color: "text-foreground", icon: TrendingDown },
  }

  const { color, icon: Icon } = config[type] || { color: "text-foreground", icon: AlertCircle }

  return <Icon className={`h-4 w-4 ${color}`} />
}

const RECENT_ALERTS_COUNT = 8

export default function DashboardPage() {
  const { user } = useUser()
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "1Y">("30D")
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<UserAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  useEffect(() => {
    fetchOpportunities()
      .then(setOpportunities)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.email) {
      setRecentAlerts([])
      return
    }
    let cancelled = false
    setAlertsLoading(true)
    fetchUserAlerts(user.email)
      .then((rows) => {
        if (!cancelled) setRecentAlerts(rows.slice(0, RECENT_ALERTS_COUNT))
      })
      .catch(() => {
        if (!cancelled) setRecentAlerts([])
      })
      .finally(() => {
        if (!cancelled) setAlertsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.email])

  const topOpportunities = opportunities
    .sort((a, b) => b.gapScore - a.gapScore)
    .slice(0, 8)

  const trendData = React.useMemo(() => {
    const n = getTrendLength(timeRange)
    return Array.from({ length: n }, (_, i) => ({
      day: i + 1,
      opportunities: Math.floor(35 + Math.random() * 20 + (i / Math.max(n - 1, 1)) * 15),
      avgScore: 72 + Math.random() * 10,
    }))
  }, [timeRange])

  const heatmapMatrix = React.useMemo(() => {
    if (!opportunities.length) {
      return { rows: [] as { sector: string; data: { cap: string; value: number | null }[] }[] }
    }
    const sectorLabel = (o: Opportunity) => (o.sector?.trim() ? o.sector : "Unknown")
    const byCount = new Map<string, number>()
    for (const o of opportunities) {
      const s = sectorLabel(o)
      byCount.set(s, (byCount.get(s) || 0) + 1)
    }
    const topSectors = [...byCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => s)

    const rows = topSectors.map((sector) => ({
      sector,
      data: MARKET_CAP_BUCKETS.map((cap) => {
        const scores = opportunities.filter(
          (o) => sectorLabel(o) === sector && capBucketUsd(o.marketCap) === cap
        ).map((o) => o.gapScore)
        if (scores.length === 0) return { cap, value: null }
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        return { cap, value: Math.round(avg) }
      }),
    }))
    return { rows }
  }, [opportunities])

  const heatmapTopSectors = React.useMemo(() => {
    const sectorLabel = (o: Opportunity) => (o.sector?.trim() ? o.sector : "Unknown")
    const bySector = new Map<string, number[]>()
    for (const o of opportunities) {
      const s = sectorLabel(o)
      if (!bySector.has(s)) bySector.set(s, [])
      bySector.get(s)!.push(o.gapScore)
    }
    return [...bySector.entries()]
      .map(([sector, scores]) => ({
        sector,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4)
  }, [opportunities])

  const quickStats = React.useMemo(() => {
    if (!opportunities.length) {
      return {
        avgAnalyst: "—",
        medianCap: "—",
        topSector: "—",
        volumeVsMedian: "—" as string,
        volumeClass: "",
      }
    }
    const avgAnalyst =
      opportunities.reduce((s, o) => s + o.analystCount, 0) / opportunities.length
    const medCap = medianPositive(opportunities.map((o) => o.marketCap))
    const sectorLabel = (o: Opportunity) => (o.sector?.trim() ? o.sector : "Unknown")
    const counts = new Map<string, number>()
    for (const o of opportunities) {
      const s = sectorLabel(o)
      counts.set(s, (counts.get(s) || 0) + 1)
    }
    const topSector = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"

    const vols = opportunities.map((o) => o.avgVolume).filter((v) => v > 0)
    const medVol = medianPositive(vols)
    const meanVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0
    let volumeVsMedian = "—"
    let volumeClass = ""
    if (medVol > 0 && meanVol > 0) {
      const pct = (meanVol / medVol - 1) * 100
      volumeVsMedian = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`
      volumeClass = pct >= 0 ? "text-success" : "text-destructive"
    }

    return {
      avgAnalyst: avgAnalyst.toFixed(1),
      medianCap: medCap > 0 ? formatMarketCap(medCap) : "—",
      topSector,
      volumeVsMedian,
      volumeClass,
    }
  }, [opportunities])

  const summaryStats = [
    {
      title: "Total Stocks Tracked",
      value: String(opportunities.length),
      icon: BarChart3,
      change: "",
      trend: "up" as const,
    },
    {
      title: "Under-Covered Opportunities",
      value: String(opportunities.filter((o) => o.gapScore >= 60).length),
      icon: Eye,
      change: "",
      trend: "up" as const,
      highlight: true,
    },
    {
      title: "High Priority",
      value: String(opportunities.filter((o) => o.opportunityType === "High Priority").length),
      icon: TrendingUp,
      change: "",
      trend: "up" as const,
    },
    {
      title: "Average Gap Score",
      value: opportunities.length
        ? (opportunities.reduce((s, o) => s + o.gapScore, 0) / opportunities.length).toFixed(1)
        : "—",
      icon: Activity,
      change: "",
      trend: "up" as const,
      infoTooltip: GAP_SCORE_INFO,
    },
  ]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Loading opportunities…</p>
        </div>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Error loading data</p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1440px] px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of market opportunities and alerts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryStats.map((stat) => (
          <SummaryCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Main + sidebar: same row height; sidebar fills with flex + scroll */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Trend Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">
                Opportunities Over Time
              </CardTitle>
              <div className="flex gap-1">
                {(["7D", "30D", "90D", "1Y"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="text-xs"
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="opportunityGradient" x1="0" y1="0" x2="0" y2="1">
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#141417",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#fafafa" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="opportunities"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      fill="url(#opportunityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Opportunities Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">
                Top Opportunities
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/opportunities" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left font-medium py-3 px-2">#</th>
                      <th className="text-left font-medium py-3 px-2">Ticker</th>
                      <th className="text-left font-medium py-3 px-2 hidden sm:table-cell">
                        Sector
                      </th>
                      <th className="text-right font-medium py-3 px-2">Gap Score</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">
                        Type
                      </th>
                      <th className="text-right font-medium py-3 px-2 hidden lg:table-cell">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topOpportunities.map((stock, index) => (
                      <tr
                        key={stock.ticker}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-2 text-muted-foreground text-sm">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2">
                          <Link href={`/stock/${stock.ticker}`} className="hover:text-primary">
                            <div className="font-medium font-mono">{stock.ticker}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {stock.company}
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground hidden sm:table-cell">
                          {stock.sector}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${stock.gapScore}%` }}
                              />
                            </div>
                            <span className="font-mono font-medium text-sm">
                              {stock.gapScore}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">
                          <OpportunityTypeBadge type={stock.opportunityType} />
                        </td>
                        <td className="py-3 px-2 text-right hidden lg:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            {stock.priceHistory.length > 0 && (
                              <MiniSparkline data={stock.priceHistory} />
                            )}
                            <div>
                              <div className="font-mono text-sm">${stock.price.toFixed(2)}</div>
                              <div
                                className={`text-xs font-mono ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}
                              >
                                {formatPercent(stock.changePercent)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Coverage Heatmap + insights: balances width, removes empty void */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">
                Coverage Heatmap
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Opportunity density by sector and market cap
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
                <div className="flex-1 min-w-0 overflow-x-auto">
                  {heatmapMatrix.rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No sector data to show yet.
                    </p>
                  ) : (
                    <div className="w-full min-w-[320px] grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2">
                      <div />
                      {MARKET_CAP_BUCKETS.map((cap) => (
                        <div
                          key={cap}
                          className="text-xs text-muted-foreground text-center py-1 font-medium"
                        >
                          {cap}
                        </div>
                      ))}
                      {heatmapMatrix.rows.map((row) => (
                        <React.Fragment key={row.sector}>
                          <div className="text-xs text-muted-foreground flex items-center pr-2 truncate font-medium">
                            {row.sector}
                          </div>
                          {row.data.map((cell) => (
                            <div
                              key={cell.cap}
                              className="min-h-[2.5rem] rounded-md flex items-center justify-center text-xs font-mono cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all border border-border/40"
                              style={
                                cell.value === null
                                  ? { backgroundColor: "transparent" }
                                  : {
                                      backgroundColor: `rgba(124, 58, 237, ${cell.value / 100})`,
                                      color: cell.value > 50 ? "#fff" : "#a1a1aa",
                                    }
                              }
                              title={
                                cell.value === null
                                  ? `${row.sector} — ${cell.cap}: no names`
                                  : `${row.sector} — ${cell.cap}: avg gap ${cell.value}`
                              }
                            >
                              {cell.value === null ? "—" : cell.value}
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                <div className="xl:w-[280px] shrink-0 flex flex-col gap-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Legend
                    </p>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden ring-1 ring-border">
                      {[0.15, 0.35, 0.55, 0.75, 0.95].map((a, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ backgroundColor: `rgba(124, 58, 237, ${a})` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Darker violet = higher average gap score (0–100) in that sector × cap bucket.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      Hot sectors (avg)
                    </div>
                    <ul className="space-y-2">
                      {heatmapTopSectors.length === 0 ? (
                        <li className="text-xs text-muted-foreground">No data</li>
                      ) : (
                        heatmapTopSectors.map(({ sector, avg }) => (
                          <li
                            key={sector}
                            className="flex items-center justify-between text-sm gap-2"
                          >
                            <span className="text-muted-foreground truncate">{sector}</span>
                            <span className="font-mono text-xs text-primary tabular-nums">
                              {avg.toFixed(0)}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <Button className="w-full gap-2" asChild>
                    <Link href="/screener">
                      <Filter className="h-4 w-4" />
                      Open screener
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: stretches to main column height; alerts scroll inside */}
        <aside className="flex flex-col gap-6 min-h-0 lg:h-full lg:min-h-[520px]">
          <Card className="flex flex-col flex-1 min-h-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
              <CardTitle className="text-lg font-semibold">Recent Alerts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/alerts" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {alertsLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading alerts…
                </div>
              ) : recentAlerts.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <p>No alerts yet.</p>
                  <p className="mt-2">
                    <Link href="/alerts" className="text-primary hover:underline font-medium">
                      Open Alerts
                    </Link>{" "}
                    to manage notifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-1">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                        alert.read
                          ? "border-border bg-transparent"
                          : "border-primary/30 bg-primary/5"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <AlertTypeBadge type={alert.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/stock/${alert.ticker}`}
                            className="font-mono font-medium text-sm hover:text-primary"
                          >
                            {alert.ticker}
                          </Link>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              alert.severity === "high"
                                ? "border-destructive/50 text-destructive"
                                : alert.severity === "medium"
                                  ? "border-warning/50 text-warning"
                                  : "border-muted-foreground/50 text-muted-foreground"
                            }`}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground/90 line-clamp-1">
                          {alert.title}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getRelativeTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
              <p className="text-xs text-muted-foreground">Snapshot from your universe</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex justify-between items-center gap-2 py-2 border-b border-border/60">
                <span className="text-sm text-muted-foreground">Avg Analyst Count</span>
                <span className="font-mono font-medium text-sm">{quickStats.avgAnalyst}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2 border-b border-border/60">
                <span className="text-sm text-muted-foreground">Median Market Cap</span>
                <span className="font-mono font-medium text-sm">{quickStats.medianCap}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2 border-b border-border/60">
                <span className="text-sm text-muted-foreground">Top Sector</span>
                <span className="font-medium text-sm text-right truncate max-w-[55%]">
                  {quickStats.topSector}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2">
                <span className="text-sm text-muted-foreground">Mean vol vs median</span>
                <span
                  className={`font-mono font-medium text-sm ${quickStats.volumeClass || "text-muted-foreground"}`}
                >
                  {quickStats.volumeVsMedian}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
