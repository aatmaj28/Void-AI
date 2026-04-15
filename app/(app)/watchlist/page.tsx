"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Plus,
  Trash2,
  Edit2,
  MoreHorizontal,
  GripVertical,
  Download,
  X,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatPercent } from "@/lib/mock-data"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"
import { useWatchlist } from "@/lib/watchlist-context"
import {
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts"

const COLORS = ["#14B8A6", "#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#2DD4BF"]

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ index, value }))
  if (data.length === 0) return null;
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

export default function WatchlistPage() {
  const { watchlists, createWatchlist, deleteWatchlist, renameWatchlist, removeStock } = useWatchlist()
  
  const [activeWatchlist, setActiveWatchlist] = useState("general")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState("")

  const [allStocks, setAllStocks] = useState<Opportunity[]>([])

  useEffect(() => {
    // If the general watchlist isn't the active one and was recently deleted (if they delete currently active), fallback to general
    if (!watchlists.find(w => w.id === activeWatchlist) && watchlists.length > 0) {
      setActiveWatchlist("general")
    }
  }, [watchlists, activeWatchlist])

  useEffect(() => {
    fetchOpportunities()
      .then(setAllStocks)
      .catch(console.error)
  }, [])

  const currentWatchlist = watchlists.find((w) => w.id === activeWatchlist) || watchlists[0]
  const watchlistStocks = currentWatchlist
    ? allStocks.filter((s) => currentWatchlist.stocks.includes(s.ticker))
    : []

  const sectorData = watchlistStocks.reduce(
    (acc, stock) => {
      const existing = acc.find((a) => a.name === stock.sector)
      if (existing) {
        existing.value++
      } else {
        acc.push({ name: stock.sector, value: 1 })
      }
      return acc
    },
    [] as { name: string; value: number }[]
  )

  const avgGapScore =
    watchlistStocks.length > 0
      ? Math.round(watchlistStocks.reduce((sum, s) => sum + s.gapScore, 0) / watchlistStocks.length)
      : 0

  const handleCreateWatchlist = () => {
    if (!newWatchlistName.trim()) return
    createWatchlist(newWatchlistName)
    // Find newly created watchlist to set active (best effort logic without returning ID from createWatchlist)
    setTimeout(() => {
        const stored = localStorage.getItem("void_watchlists")
        if (stored) {
            const parsed = JSON.parse(stored)
            const latest = parsed[parsed.length - 1]
            if (latest.name === newWatchlistName) setActiveWatchlist(latest.id)
        }
    }, 100)

    setNewWatchlistName("")
    setShowCreateDialog(false)
  }

  const handleRenameWatchlist = (id: string) => {
    if (!newName.trim()) {
      setEditingName(null)
      return
    }
    renameWatchlist(id, newName)
    setEditingName(null)
    setNewName("")
  }

  const startRename = (id: string, name: string) => {
    setEditingName(id)
    setNewName(name)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground mt-1">
            Track your favorite opportunities
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Watchlist
            </Button>
          </DialogTrigger>
          
          {/* Spotlight Overlay */}
          <div className={`fixed inset-0 z-[49] bg-background/80 transition-opacity duration-300 pointer-events-none ${showCreateDialog ? 'opacity-100' : 'opacity-0'}`} />
          
          <DialogContent className="sm:max-w-[425px] border-border bg-card overflow-hidden sm:rounded-xl z-50">
             <div className="relative z-10 p-2">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Create Watchlist</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground pt-2">
                    Organize your high-conviction ideas logically.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <Input
                      placeholder="e.g. AI Hardware Plays"
                      value={newWatchlistName}
                      onChange={(e) => setNewWatchlistName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateWatchlist()}
                      className="bg-background/50 border-border/50 text-base py-5"
                      autoFocus
                    />
                </div>

                <DialogFooter className="mt-8 pt-4 border-t border-border/30 gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateWatchlist}
                    disabled={!newWatchlistName.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Create Watchlist
                  </Button>
                </DialogFooter>
             </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Tabs value={activeWatchlist} onValueChange={setActiveWatchlist}>
          <TabsList className="h-auto flex-wrap gap-1 p-1 bg-secondary/20">
            {watchlists.map((watchlist, i) => (
              <div key={watchlist.id} className="flex items-center relative group">
                <TabsTrigger
                  value={watchlist.id}
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative px-4"
                >
                  {editingName === watchlist.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameWatchlist(watchlist.id)
                          if (e.key === "Escape") setEditingName(null)
                        }}
                        className="h-6 w-24 text-xs bg-background/50 border-none text-foreground"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-transparent"
                        onClick={() => handleRenameWatchlist(watchlist.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {watchlist.name}
                      <Badge variant="secondary" className="ml-1 text-xs bg-background/20 group-data-[state=active]:bg-background/20">
                        {watchlist.stocks.length}
                      </Badge>
                      
                      {/* Inline Quick Delete X */}
                      {watchlist.id !== "general" && (
                         <div 
                           className="ml-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive text-primary-foreground"
                           onClick={(e) => { e.stopPropagation(); deleteWatchlist(watchlist.id); }}
                         >
                            <X className="h-3 w-3" />
                         </div>
                      )}
                    </>
                  )}
                </TabsTrigger>
                {/* Genral Tab Separator */}
                {i === 0 && watchlists.length > 1 && (
                  <div className="h-5 w-[1px] bg-border mx-2" />
                )}
              </div>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">
                {currentWatchlist?.name}
              </CardTitle>
              {currentWatchlist?.id !== "general" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => currentWatchlist && startRename(currentWatchlist.id, currentWatchlist.name)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Export Focus List
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => currentWatchlist && deleteWatchlist(currentWatchlist.id)}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Watchlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Stocks</span>
                <span className="font-mono font-medium">{watchlistStocks.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Gap Score</span>
                <span className="font-mono font-medium">{avgGapScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">
                  {new Date(currentWatchlist?.createdAt || new Date()).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {watchlistStocks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Sector Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sectorData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {sectorData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Table */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {watchlistStocks.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center bg-secondary/5 rounded-b-xl">
                  <p className="text-muted-foreground mb-6 text-lg">
                    This watchlist is empty
                  </p>
                  <Button variant="outline" className="border-primary/20 hover:bg-primary/10 text-primary" asChild>
                    <Link href="/opportunities">Browse Opportunities</Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border bg-secondary/30">
                        <th className="w-8 py-3 px-2"></th>
                        <th className="text-left font-medium py-3 px-4">Ticker</th>
                        <th className="text-left font-medium py-3 px-4 hidden sm:table-cell">
                          Company
                        </th>
                        <th className="text-left font-medium py-3 px-4 hidden md:table-cell">
                          Sector
                        </th>
                        <th className="text-right font-medium py-3 px-4">Gap Score</th>
                        <th className="text-right font-medium py-3 px-4 hidden lg:table-cell">
                          Price
                        </th>
                        <th className="text-right font-medium py-3 px-4 hidden md:table-cell">
                          Change
                        </th>
                        <th className="text-right font-medium py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlistStocks.map((stock) => (
                        <tr
                          key={stock.ticker}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors group"
                        >
                          <td className="py-3 px-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/stock/${stock.ticker}`}
                              className="font-mono font-semibold text-primary hover:text-cyan transition-colors"
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
                            <Badge variant="secondary" className="text-xs font-normal">
                              {stock.sector}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${stock.gapScore}%` }}
                                />
                              </div>
                              <span className="font-mono font-semibold">{stock.gapScore}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right hidden lg:table-cell">
                            <div className="flex items-center justify-end gap-3">
                              {stock.priceHistory && stock.priceHistory.length > 0 && <MiniSparkline data={stock.priceHistory} />}
                              <span className="font-mono text-sm">
                                ${stock.price.toFixed(2)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right hidden md:table-cell">
                            <span
                              className={`font-mono text-sm ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}
                            >
                              {formatPercent(stock.changePercent)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => currentWatchlist && removeStock(currentWatchlist.id, stock.ticker)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/stock/${stock.ticker}`}>View</Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
