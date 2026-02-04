"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  X,
  Save,
  Play,
  Trash2,
  Copy,
  MoreHorizontal,
  Star,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { mockStocks, formatMarketCap, formatPercent } from "@/lib/mock-data"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface Condition {
  id: string
  metric: string
  operator: string
  value: string
}

interface SavedScreen {
  id: string
  name: string
  conditions: Condition[]
}

const metrics = [
  { value: "gapScore", label: "Gap Score" },
  { value: "activityScore", label: "Activity Score" },
  { value: "analystCount", label: "Analyst Count" },
  { value: "marketCap", label: "Market Cap ($M)" },
  { value: "changePercent", label: "% Change" },
  { value: "price", label: "Price" },
]

const operators = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
]

const defaultSavedScreens: SavedScreen[] = [
  {
    id: "1",
    name: "High Gap Score",
    conditions: [{ id: "1", metric: "gapScore", operator: "gte", value: "80" }],
  },
  {
    id: "2",
    name: "Under-Covered Tech",
    conditions: [
      { id: "1", metric: "analystCount", operator: "lte", value: "5" },
      { id: "2", metric: "gapScore", operator: "gte", value: "70" },
    ],
  },
  {
    id: "3",
    name: "High Activity",
    conditions: [{ id: "1", metric: "activityScore", operator: "gte", value: "85" }],
  },
]

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

export default function ScreenerPage() {
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "1", metric: "gapScore", operator: "gte", value: "70" },
  ])
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>(defaultSavedScreens)
  const [activeScreen, setActiveScreen] = useState<string | null>(null)
  const [newScreenName, setNewScreenName] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      metric: "gapScore",
      operator: "gte",
      value: "50",
    }
    setConditions([...conditions, newCondition])
  }

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
  }

  const updateCondition = (id: string, field: keyof Condition, value: string) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const loadScreen = (screen: SavedScreen) => {
    setConditions(screen.conditions)
    setActiveScreen(screen.id)
  }

  const saveScreen = () => {
    if (!newScreenName.trim()) return

    const newScreen: SavedScreen = {
      id: Date.now().toString(),
      name: newScreenName,
      conditions: [...conditions],
    }
    setSavedScreens([...savedScreens, newScreen])
    setNewScreenName("")
    setShowSaveDialog(false)
    setActiveScreen(newScreen.id)
  }

  const deleteScreen = (id: string) => {
    setSavedScreens(savedScreens.filter((s) => s.id !== id))
    if (activeScreen === id) setActiveScreen(null)
  }

  const duplicateScreen = (screen: SavedScreen) => {
    const newScreen: SavedScreen = {
      id: Date.now().toString(),
      name: `${screen.name} (Copy)`,
      conditions: [...screen.conditions],
    }
    setSavedScreens([...savedScreens, newScreen])
  }

  const filteredStocks = useMemo(() => {
    return mockStocks.filter((stock) => {
      return conditions.every((condition) => {
        let stockValue: number

        switch (condition.metric) {
          case "gapScore":
            stockValue = stock.gapScore
            break
          case "activityScore":
            stockValue = stock.activityScore
            break
          case "analystCount":
            stockValue = stock.analystCount
            break
          case "marketCap":
            stockValue = stock.marketCap / 1e6
            break
          case "changePercent":
            stockValue = stock.changePercent
            break
          case "price":
            stockValue = stock.price
            break
          default:
            return true
        }

        const targetValue = parseFloat(condition.value)
        if (isNaN(targetValue)) return true

        switch (condition.operator) {
          case "gt":
            return stockValue > targetValue
          case "gte":
            return stockValue >= targetValue
          case "lt":
            return stockValue < targetValue
          case "lte":
            return stockValue <= targetValue
          case "eq":
            return stockValue === targetValue
          default:
            return true
        }
      })
    })
  }, [conditions])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Screener</h1>
        <p className="text-muted-foreground mt-1">
          Build custom screens to find opportunities matching your criteria
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved Screens Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saved Screens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedScreens.map((screen) => (
                <div
                  key={screen.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    activeScreen === screen.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-secondary"
                  }`}
                  onClick={() => loadScreen(screen)}
                >
                  <span className="text-sm font-medium truncate">{screen.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => duplicateScreen(screen)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteScreen(screen.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 bg-transparent"
                onClick={() => {
                  setConditions([{ id: "1", metric: "gapScore", operator: "gte", value: "50" }])
                  setActiveScreen(null)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Screen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Screen Builder */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Screen Builder</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Add conditions to filter stocks
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {filteredStocks.length} stocks match
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                  {index > 0 && (
                    <Badge variant="outline" className="text-xs">
                      AND
                    </Badge>
                  )}
                  <Select
                    value={condition.metric}
                    onValueChange={(v) => updateCondition(condition.id, "metric", v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(condition.id, "operator", v)}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                    className="w-24"
                  />

                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(condition.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Condition
                </Button>

                {showSaveDialog ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Screen name..."
                      value={newScreenName}
                      onChange={(e) => setNewScreenName(e.target.value)}
                      className="w-40"
                    />
                    <Button size="sm" onClick={saveScreen}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSaveDialog(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Screen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border bg-secondary/30">
                      <th className="text-left font-medium py-3 px-4">Ticker</th>
                      <th className="text-left font-medium py-3 px-4 hidden sm:table-cell">
                        Company
                      </th>
                      <th className="text-left font-medium py-3 px-4 hidden md:table-cell">
                        Sector
                      </th>
                      <th className="text-right font-medium py-3 px-4">Gap Score</th>
                      <th className="text-right font-medium py-3 px-4 hidden md:table-cell">
                        Activity
                      </th>
                      <th className="text-right font-medium py-3 px-4 hidden lg:table-cell">
                        Price
                      </th>
                      <th className="text-right font-medium py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="text-muted-foreground">
                            <p className="text-lg font-medium mb-2">No stocks match</p>
                            <p className="text-sm">Try adjusting your conditions</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStocks.slice(0, 20).map((stock) => (
                        <tr
                          key={stock.ticker}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Link
                              href={`/stock/${stock.ticker}`}
                              className="font-mono font-semibold hover:text-primary transition-colors"
                            >
                              {stock.ticker}
                            </Link>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                              {stock.company}
                            </span>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell">
                            <Badge variant="secondary" className="text-xs">
                              {stock.sector}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-2 bg-secondary rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-gradient-to-r from-primary to-cyan rounded-full"
                                  style={{ width: `${stock.gapScore}%` }}
                                />
                              </div>
                              <span className="font-mono font-semibold">{stock.gapScore}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm hidden md:table-cell">
                            {stock.activityScore}
                          </td>
                          <td className="py-3 px-4 text-right hidden lg:table-cell">
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
                          <td className="py-3 px-4 text-right">
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
              {filteredStocks.length > 20 && (
                <div className="p-4 text-center border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing 20 of {filteredStocks.length} results
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
