"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  Filter,
  Download,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  X,
  Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  mockStocks,
  formatMarketCap,
  formatPercent,
  type Stock,
} from "@/lib/mock-data"
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts"

const sectors = ["All", "Technology", "Healthcare", "Finance", "Industrial", "Consumer", "Energy", "Communications"]
const opportunityTypes = ["All", "High Activity Low Coverage", "Emerging Coverage Gap", "Institutional Blind Spot", "Sector Mispricing"]

type SortKey = "ticker" | "gapScore" | "activityScore" | "marketCap" | "analystCount" | "changePercent"
type SortDirection = "asc" | "desc"

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ index, value }))
  const isPositive = data[data.length - 1] >= data[0]

  return (
    <div className="w-16 h-6">
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
    "High Activity Low Coverage": "bg-primary/10 text-primary border-primary/20",
    "Emerging Coverage Gap": "bg-cyan/10 text-cyan border-cyan/20",
    "Institutional Blind Spot": "bg-warning/10 text-warning border-warning/20",
    "Sector Mispricing": "bg-success/10 text-success border-success/20",
  }

  return (
    <Badge variant="outline" className={`text-xs whitespace-nowrap ${colors[type] || ""}`}>
      {type}
    </Badge>
  )
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  direction,
  onSort,
  className = "",
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = currentSort === sortKey

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 font-medium hover:text-foreground transition-colors ${className}`}
    >
      {label}
      {isActive ? (
        direction === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

export default function OpportunitiesPage() {
  const [search, setSearch] = useState("")
  const [selectedSector, setSelectedSector] = useState("All")
  const [selectedType, setSelectedType] = useState("All")
  const [minGapScore, setMinGapScore] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>("gapScore")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(true)

  const filteredStocks = useMemo(() => {
    return mockStocks
      .filter((stock) => {
        const matchesSearch =
          search === "" ||
          stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
          stock.company.toLowerCase().includes(search.toLowerCase())
        const matchesSector = selectedSector === "All" || stock.sector === selectedSector
        const matchesType = selectedType === "All" || stock.opportunityType === selectedType
        const matchesGapScore = stock.gapScore >= minGapScore

        return matchesSearch && matchesSector && matchesType && matchesGapScore
      })
      .sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        return sortDirection === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number)
      })
  }, [search, selectedSector, selectedType, minGapScore, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDirection("desc")
    }
  }

  const toggleStock = (ticker: string) => {
    const newSelected = new Set(selectedStocks)
    if (newSelected.has(ticker)) {
      newSelected.delete(ticker)
    } else {
      newSelected.add(ticker)
    }
    setSelectedStocks(newSelected)
  }

  const toggleAll = () => {
    if (selectedStocks.size === filteredStocks.length) {
      setSelectedStocks(new Set())
    } else {
      setSelectedStocks(new Set(filteredStocks.map((s) => s.ticker)))
    }
  }

  const clearFilters = () => {
    setSearch("")
    setSelectedSector("All")
    setSelectedType("All")
    setMinGapScore(0)
  }

  const hasActiveFilters =
    search !== "" || selectedSector !== "All" || selectedType !== "All" || minGapScore > 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Opportunities</h1>
        <p className="text-muted-foreground mt-1">
          Discover under-covered stocks with high market activity
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stocks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground">
                    !
                  </Badge>
                )}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredStocks.length} stocks found
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sector</label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Opportunity Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Min Gap Score: {minGapScore}
                </label>
                <Slider
                  value={[minGapScore]}
                  onValueChange={(v) => setMinGapScore(v[0])}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>

              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="text-left font-medium py-3 px-4">
                    <Checkbox
                      checked={
                        selectedStocks.size === filteredStocks.length &&
                        filteredStocks.length > 0
                      }
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="text-left font-medium py-3 px-4">
                    <SortHeader
                      label="Ticker"
                      sortKey="ticker"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden sm:table-cell">Company</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Sector</th>
                  <th className="text-right font-medium py-3 px-4 hidden lg:table-cell">
                    <SortHeader
                      label="Market Cap"
                      sortKey="marketCap"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="text-right font-medium py-3 px-4 hidden md:table-cell">
                    <SortHeader
                      label="Analysts"
                      sortKey="analystCount"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="text-right font-medium py-3 px-4">
                    <SortHeader
                      label="Gap Score"
                      sortKey="gapScore"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="text-right font-medium py-3 px-4 hidden lg:table-cell">
                    <SortHeader
                      label="Activity"
                      sortKey="activityScore"
                      currentSort={sortKey}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="text-left font-medium py-3 px-4 hidden xl:table-cell">Type</th>
                  <th className="text-right font-medium py-3 px-4 hidden lg:table-cell">Price</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="text-muted-foreground">
                        <p className="text-lg font-medium mb-2">No opportunities found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => (
                    <tr
                      key={stock.ticker}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <Checkbox
                          checked={selectedStocks.has(stock.ticker)}
                          onCheckedChange={() => toggleStock(stock.ticker)}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          href={`/stock/${stock.ticker}`}
                          className="font-mono font-semibold hover:text-primary transition-colors"
                        >
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="py-4 px-4 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {stock.company}
                        </span>
                      </td>
                      <td className="py-4 px-4 hidden md:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {stock.sector}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm hidden lg:table-cell">
                        {formatMarketCap(stock.marketCap)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm hidden md:table-cell">
                        {stock.analystCount}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-cyan rounded-full"
                              style={{ width: `${stock.gapScore}%` }}
                            />
                          </div>
                          <span className="font-mono font-semibold">{stock.gapScore}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm hidden lg:table-cell">
                        {stock.activityScore}
                      </td>
                      <td className="py-4 px-4 hidden xl:table-cell">
                        <OpportunityTypeBadge type={stock.opportunityType} />
                      </td>
                      <td className="py-4 px-4 text-right hidden lg:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <MiniSparkline data={stock.priceHistory} />
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
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Star className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/stock/${stock.ticker}`}>View</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedStocks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <Card className="shadow-lg border-primary/20">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="text-sm font-medium">
                {selectedStocks.size} stock{selectedStocks.size > 1 ? "s" : ""} selected
              </span>
              <div className="h-4 w-px bg-border" />
              <Button size="sm" variant="outline" className="gap-2 bg-transparent">
                <Plus className="h-4 w-4" />
                Add to Watchlist
              </Button>
              <Button size="sm" variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStocks(new Set())}
              >
                Clear
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
