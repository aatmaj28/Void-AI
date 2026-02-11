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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockAlerts, formatMarketCap, formatPercent, getRelativeTime } from "@/lib/mock-data"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
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

// Coverage heatmap data
const sectors = ["Technology", "Healthcare", "Finance", "Industrial", "Consumer", "Energy"]
const marketCapRanges = ["Micro", "Small", "Mid", "Large"]

const heatmapData = sectors.map((sector) => ({
  sector,
  data: marketCapRanges.map((cap) => ({
    cap,
    value: Math.floor(Math.random() * 100),
  })),
}))

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
    "Strong Opportunity": "bg-cyan/10 text-cyan border-cyan/20",
    "Moderate Opportunity": "bg-warning/10 text-warning border-warning/20",
    "Low Priority": "bg-muted/50 text-muted-foreground border-muted",
    "High Activity Low Coverage": "bg-primary/10 text-primary border-primary/20",
    "Emerging Coverage Gap": "bg-cyan/10 text-cyan border-cyan/20",
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

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "1Y">("30D")
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOpportunities()
      .then(setOpportunities)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const topOpportunities = opportunities
    .sort((a, b) => b.gapScore - a.gapScore)
    .slice(0, 8)

  const recentAlerts = mockAlerts.slice(0, 5)

  const trendData = React.useMemo(() => {
    const n = getTrendLength(timeRange)
    return Array.from({ length: n }, (_, i) => ({
      day: i + 1,
      opportunities: Math.floor(35 + Math.random() * 20 + (i / Math.max(n - 1, 1)) * 15),
      avgScore: 72 + Math.random() * 10,
    }))
  }, [timeRange])

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
    <div className="container mx-auto px-4 py-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-6">
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
                                className="h-full bg-gradient-to-r from-primary to-cyan rounded-full"
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

          {/* Coverage Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Coverage Heatmap
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Opportunity density by sector and market cap
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <div className="w-full grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2">
                  <div /> {/* Empty corner */}
                  {marketCapRanges.map((cap) => (
                    <div
                      key={cap}
                      className="text-xs text-muted-foreground text-center py-1"
                    >
                      {cap}
                    </div>
                  ))}
                  {heatmapData.map((row) => (
                    <React.Fragment key={row.sector}>
                      <div className="text-xs text-muted-foreground flex items-center pr-2 truncate">
                        {row.sector}
                      </div>
                      {row.data.map((cell) => (
                        <div
                          key={cell.cap}
                          className="min-h-[2.5rem] rounded-md flex items-center justify-center text-xs font-mono cursor-pointer hover:ring-1 hover:ring-primary transition-all"
                          style={{
                            backgroundColor: `rgba(124, 58, 237, ${cell.value / 100})`,
                            color: cell.value > 50 ? "#fff" : "#a1a1aa",
                          }}
                          title={`${row.sector} - ${cell.cap}: ${cell.value}`}
                        >
                          {cell.value}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Recent Alerts */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Recent Alerts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/alerts" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getRelativeTime(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Analyst Count</span>
                <span className="font-mono font-medium">4.2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Median Market Cap</span>
                <span className="font-mono font-medium">$2.1B</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Top Sector</span>
                <span className="font-medium">Technology</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Volume vs Avg</span>
                <span className="font-mono font-medium text-success">+142%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
