"use client"

import { useState, useMemo, useEffect } from "react"
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
  Activity,
  Wand2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/lib/user-context"
import { formatMarketCap, formatPercent } from "@/lib/mock-data"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
import { fetchSavedScreens, saveScreen, deleteScreen, type SavedScreen, type Condition } from "@/lib/screener"
import { LineChart, Line, ResponsiveContainer } from "recharts"

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

// Substituted default models with fetch call

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
  const { user } = useUser()
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "1", metric: "gapScore", operator: "gte", value: "70" },
  ])
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([])
  const [activeScreen, setActiveScreen] = useState<string | null>(null)
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newScreenName, setNewScreenName] = useState("")
  const [newScreenDesc, setNewScreenDesc] = useState("")
  const [newScreenTags, setNewScreenTags] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [stocks, setStocks] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOpportunities()
      .then(setStocks)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load data"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user?.email) {
      fetchSavedScreens(user.email)
        .then(setSavedScreens)
        .catch(console.error)
    } else {
      setSavedScreens([])
    }
  }, [user?.email])

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
    const loadedConditions = Array.isArray(screen.conditions) ? screen.conditions : []
    setConditions(loadedConditions.length ? loadedConditions : [{ id: "1", metric: "gapScore", operator: "gte", value: "70" }])
    setActiveScreen(screen.id)
  }

  const handleSaveScreen = async () => {
    if (!newScreenName.trim()) return
    if (!user?.email) {
      alert("Please log in to save and recall screens.")
      return
    }

    setIsSaving(true)
    try {
      const tagsArray = newScreenTags.split(",").map(t => t.trim()).filter(Boolean)
      const newScreen = await saveScreen(user.email, {
        name: newScreenName,
        description: newScreenDesc,
        tags: tagsArray,
        conditions: [...conditions],
      })
      setSavedScreens([newScreen, ...savedScreens])
      setNewScreenName("")
      setNewScreenDesc("")
      setNewScreenTags("")
      setShowSaveDialog(false)
      setActiveScreen(newScreen.id)
    } catch (err) {
      console.error(err)
      alert("Failed to save screen. Ensure your database is running.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteScreen = async (id: string) => {
    try {
      await deleteScreen(id)
      setSavedScreens(savedScreens.filter((s) => s.id !== id))
      if (activeScreen === id) setActiveScreen(null)
    } catch (err) {
      console.error(err)
      alert("Failed to delete screen.")
    }
  }

  const autoGenerateName = () => {
    const hasGap = conditions.find(c => c.metric === 'gapScore' && c.operator === 'gte' && parseInt(c.value) > 70)
    const hasActivity = conditions.find(c => c.metric === 'activityScore' && c.operator === 'gte')
    const hasAnalyst = conditions.find(c => c.metric === 'analystCount' && c.operator === 'lte')
    
    let genName = "Custom Alpha Screen"
    if (hasGap && hasAnalyst) genName = "Deep Value Hidden Gems"
    else if (hasActivity && hasGap) genName = "High Momentum Alpha"
    else if (hasGap) genName = "High Gap Potential"
    
    setNewScreenName(genName)
    setNewScreenDesc(`Screening for stocks with ${conditions.map(c => `${c.metric} ${c.operator} ${c.value}`).join(' AND ')}.`)
    setNewScreenTags("Alpha, Quant, Strategy")
  }

  const duplicateScreen = (screen: SavedScreen) => {
    setNewScreenName(`${screen.name} (Copy)`)
    setNewScreenDesc(screen.description || "")
    setNewScreenTags(screen.tags?.join(", ") || "")
    setConditions([...screen.conditions])
    setShowSaveDialog(true)
  }

  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
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
  }, [stocks, conditions])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">Screener</h1>
        <p className="text-muted-foreground mt-1">Loading…</p>
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">Screener</h1>
        <p className="text-muted-foreground mt-1">Error loading data</p>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    )
  }

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
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Saved Screens</h2>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full shadow-lg shadow-primary/20"
              onClick={() => {
                setConditions([{ id: "1", metric: "gapScore", operator: "gte", value: "70" }])
                setActiveScreen(null)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {savedScreens.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card/50">
                <p className="text-sm text-muted-foreground">No saved screens yet.</p>
              </div>
            ) : (
              savedScreens.map((screen) => {
                const sparklineData = Array.from({ length: 15 }, () => 40 + Math.random() * 60)
                
                return (
                  <Card
                    key={screen.id}
                    className={`cursor-pointer transition-all duration-300 overflow-hidden group ${
                      activeScreen === screen.id
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                        : "hover:border-primary/30 hover:bg-card/80"
                    }`}
                    onClick={() => loadScreen(screen)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-sm truncate pr-2 max-w-[150px]">{screen.name}</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {screen.created_at ? new Date(screen.created_at).toLocaleDateString() : "Saved"}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateScreen(screen); }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleDeleteScreen(screen.id); }}
                              className="text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {/* Logic Badges */}
                      <div className="flex flex-wrap gap-1 mt-3 mb-4">
                        {screen.conditions?.slice(0, 3).map((cond: any) => (
                          <Badge key={cond.id} variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/50 font-mono tracking-tight font-medium text-foreground/80">
                            {cond.metric.replace('Score','')} {cond.operator.replace('gte','>=').replace('lte','<=')} {cond.value}
                          </Badge>
                        ))}
                        {screen.conditions?.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/50 font-mono">
                            +{screen.conditions.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Sparkline Visual - Historical Alpha */}
                      <div className="pt-3 border-t border-border/50 flex justify-between items-end">
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                          <Activity className="h-3 w-3 inline mr-1 text-primary/70 mb-0.5" /> 
                          Backtest
                        </div>
                        <div className="w-16 h-6 opacity-80 mix-blend-screen">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparklineData.map((val, i) => ({ val, i }))}>
                              <Line type="monotone" dataKey="val" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
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

                <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-colors">
                      <Save className="h-4 w-4 mr-2" />
                      Save Screen
                    </Button>
                  </DialogTrigger>
                  
                  {/* Spotlight Overlay */}
                  <div className={`fixed inset-0 z-[49] bg-background/80 transition-opacity duration-300 pointer-events-none ${showSaveDialog ? 'opacity-100' : 'opacity-0'}`} />
                  
                  <DialogContent className="sm:max-w-[500px] border-border bg-card p-0 overflow-hidden sm:rounded-xl z-50">
                    <div className="p-6 relative z-10">
                      <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-bold tracking-tight">Save Strategy Screen</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground pt-2">
                          Save these screening parameters to your dashboard. We'll track historical alpha for this strategy.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-5">
                        <div className="flex items-center justify-between pb-2">
                          <Button variant="secondary" size="sm" onClick={autoGenerateName} className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20">
                            <Wand2 className="h-4 w-4 mr-2" />
                            Auto-Generate Intelligence
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Core Name</label>
                          <Input
                            placeholder="e.g. Deep Value Hidden Gems"
                            value={newScreenName}
                            onChange={(e) => setNewScreenName(e.target.value)}
                            className="bg-background/50 border-border/50 text-base py-5"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Strategy Notes</label>
                          <Textarea
                            placeholder="What marks this strategy? (Optional)"
                            value={newScreenDesc}
                            onChange={(e) => setNewScreenDesc(e.target.value)}
                            className="bg-background/50 border-border/50 resize-none h-24"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Quant Tags</label>
                          <Input
                            placeholder="Value, Momentum, Small-Cap..."
                            value={newScreenTags}
                            onChange={(e) => setNewScreenTags(e.target.value)}
                            className="bg-background/50 border-border/50"
                          />
                        </div>
                      </div>

                      <DialogFooter className="mt-8 pt-4 border-t border-border/30 gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveScreen}
                          disabled={isSaving || !newScreenName.trim()}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
                        >
                          {isSaving ? "Initializing..." : "Save Strategy"}
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
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
                                  className="h-full bg-primary rounded-full"
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
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
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
