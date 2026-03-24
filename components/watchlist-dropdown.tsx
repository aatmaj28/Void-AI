"use client"

import * as React from "react"
import { Star, Check, Plus } from "lucide-react"
import { useWatchlist } from "@/lib/watchlist-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

interface WatchlistDropdownProps {
  ticker: string
  companyName?: string
}

export function WatchlistDropdown({ ticker, companyName }: WatchlistDropdownProps) {
  const { watchlists, addStock, removeStock, createWatchlist, getAllWatchlistsForStock } = useWatchlist()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [newListName, setNewListName] = React.useState("")
  const { toast } = useToast()

  const activeLists = getAllWatchlistsForStock(ticker)
  const isStarred = activeLists.length > 0

  const toggleWatchlist = (watchlistId: string, name: string) => {
    const isInList = activeLists.find((w) => w.id === watchlistId)
    if (isInList) {
      removeStock(watchlistId, ticker)
      toast({
        title: "Removed from Watchlist",
        description: `${ticker} removed from ${name}.`,
      })
    } else {
      addStock(watchlistId, ticker)
      toast({
        title: "Added to Watchlist",
        description: `${ticker} added to ${name}.`,
      })
    }
    // Optional: Close dropdown after clicking
    // setIsOpen(false) 
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return
    createWatchlist(newListName)
    setNewListName("")
    setIsCreating(false)
    toast({
      title: "Watchlist Created",
      description: `Successfully created ${newListName}.`,
    })
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) setIsCreating(false)
    }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 transition-colors ${
            isStarred ? "text-primary hover:text-primary/80 hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className={`h-4 w-4 ${isStarred ? "fill-primary" : ""}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 p-1.5 border-primary/40 bg-card/95 backdrop-blur-2xl shadow-[0_0_30px_rgba(124,58,237,0.25)] ring-1 ring-primary/20 rounded-xl"
      >
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground flex justify-between items-center px-2 py-1.5">
          <span>Save <span className="font-bold text-foreground text-primary">{ticker}</span> to...</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuGroup className="max-h-[200px] overflow-y-auto">
          {watchlists.map((w) => {
            const isSelected = activeLists.some((active) => active.id === w.id)
            return (
              <DropdownMenuItem
                key={w.id}
                onSelect={(e) => {
                  e.preventDefault()
                  toggleWatchlist(w.id, w.name)
                }}
                className="flex items-center justify-between cursor-pointer rounded-md focus:bg-primary/10 mb-0.5"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="truncate">{w.name}</span>
                </div>
                {w.id === "general" && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Default</Badge>}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border/50" />
        {isCreating ? (
          <form onSubmit={handleCreate} className="p-1 px-2 pb-2">
            <Input
              autoFocus
              placeholder="Watchlist name..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="h-8 text-xs bg-background/50 border-primary/30 focus-visible:ring-1 focus-visible:ring-primary mb-2"
            />
            <div className="flex gap-1">
              <Button type="submit" size="sm" className="h-7 w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                Create
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault()
              setIsCreating(true)
            }}
            className="text-primary focus:bg-primary/10 focus:text-primary cursor-pointer mt-0.5"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Watchlist</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
