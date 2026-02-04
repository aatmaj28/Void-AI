"use client"

import { useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  mockStocks,
  mockWatchlists,
  formatMarketCap,
  formatPercent,
  type Watchlist,
} from "@/lib/mock-data"
import {
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts"

const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

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

export default function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(mockWatchlists)
  const [activeWatchlist, setActiveWatchlist] = useState(watchlists[0]?.id || "")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState("")

  const currentWatchlist = watchlists.find((w) => w.id === activeWatchlist)
  const watchlistStocks = currentWatchlist
    ? mockStocks.filter((s) => currentWatchlist.stocks.includes(s.ticker))
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

  const createWatchlist = () => {
    if (!newWatchlistName.trim()) return

    const newWatchlist: Watchlist = {
      id: Date.now().toString(),
      name: newWatchlistName,
      stocks: [],
      createdAt: new Date(),
    }
    setWatchlists([...watchlists, newWatchlist])
    setActiveWatchlist(newWatchlist.id)
    setNewWatchlistName("")
    setShowCreateDialog(false)
  }

  const deleteWatchlist = (id: string) => {
    const filtered = watchlists.filter((w) => w.id !== id)
    setWatchlists(filtered)
    if (activeWatchlist === id && filtered.length > 0) {
      setActiveWatchlist(filtered[0].id)
    }
  }

  const renameWatchlist = (id: string) => {
    if (!newName.trim()) {
      setEditingName(null)
      return
    }
    setWatchlists(
      watchlists.map((w) => (w.id === id ? { ...w, name: newName } : w))
    )
    setEditingName(null)
    setNewName("")
  }

  const removeFromWatchlist = (ticker: string) => {
    setWatchlists(
      watchlists.map((w) =>
        w.id === activeWatchlist
          ? { ...w, stocks: w.stocks.filter((s) => s !== ticker) }
          : w
      )
    )
  }

  const startRename = (watchlist: Watchlist) => {
    setEditingName(watchlist.id)
    setNewName(watchlist.name)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground mt-1">
            Track your favorite opportunities
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Watchlist
        </Button>
      </div>

      {/* Create Watchlist Dialog */}
      {showCreateDialog && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Watchlist name..."
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
                autoFocus
              />
              <Button size="sm" onClick={createWatchlist}>
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {watchlists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You don't have any watchlists yet
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Watchlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Watchlist Tabs */}
          <Tabs value={activeWatchlist} onValueChange={setActiveWatchlist} className="mb-6">
            <TabsList className="h-auto flex-wrap gap-1">
              {watchlists.map((watchlist) => (
                <TabsTrigger
                  key={watchlist.id}
                  value={watchlist.id}
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {editingName === watchlist.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameWatchlist(watchlist.id)
                          if (e.key === "Escape") setEditingName(null)
                        }}
                        className="h-6 w-24 text-xs"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => renameWatchlist(watchlist.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {watchlist.name}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {watchlist.stocks.length}
                      </Badge>
                    </>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Stats Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">
                    {currentWatchlist?.name}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => currentWatchlist && startRename(currentWatchlist)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => currentWatchlist && deleteWatchlist(currentWatchlist.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      {currentWatchlist?.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {watchlistStocks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sector Distribution</CardTitle>
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
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {sectorData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
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
                    <div className="py-12 text-center">
                      <p className="text-muted-foreground mb-4">
                        This watchlist is empty
                      </p>
                      <Button variant="outline" asChild>
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
                              <td className="py-3 px-4 text-right hidden lg:table-cell">
                                <div className="flex items-center justify-end gap-2">
                                  <MiniSparkline data={stock.priceHistory} />
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
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeFromWatchlist(stock.ticker)}
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
        </>
      )}
    </div>
  )
}
