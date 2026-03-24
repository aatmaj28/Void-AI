"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"
import { Watchlist } from "./mock-data"
import { useUser } from "@/lib/user-context"
import {
  fetchWatchlists,
  createWatchlistDb,
  updateWatchlistStocks,
  deleteWatchlistDb,
  renameWatchlistDb
} from "./watchlists"
import { useToast } from "@/components/ui/use-toast"

interface WatchlistContextType {
  watchlists: Watchlist[]
  addStock: (watchlistId: string, ticker: string) => void
  removeStock: (watchlistId: string, ticker: string) => void
  createWatchlist: (name: string) => void
  deleteWatchlist: (id: string) => void
  renameWatchlist: (id: string, newName: string) => void
  isStockInWatchlist: (watchlistId: string, ticker: string) => boolean
  getAllWatchlistsForStock: (ticker: string) => Watchlist[]
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined)

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const { toast } = useToast()
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])

  const loadWatchlists = useCallback(async () => {
    if (!user?.email) {
      setWatchlists([])
      return
    }
    
    try {
      const data = await fetchWatchlists(user.email)

      if (data.length === 0) {
        // Initialize a General watchlist for the new user profile
        const generalList = await createWatchlistDb(user.email, "General", true)
        setWatchlists([generalList])
      } else {
        setWatchlists(data)
      }
    } catch (e: any) {
      console.error("Failed to load watchlists:", e)
      toast({ title: "Failed to load watchlists", description: e.message, variant: "destructive" })
    }
  }, [user?.email, toast])

  useEffect(() => {
    loadWatchlists()
  }, [loadWatchlists])

  const addStock = async (watchlistId: string, ticker: string) => {
    const list = watchlists.find(w => w.id === watchlistId)
    if (!list || list.stocks.includes(ticker)) return

    const newStocks = [...list.stocks, ticker]
    // Optimistic Update
    setWatchlists(prev => prev.map(w => w.id === watchlistId ? { ...w, stocks: newStocks } : w))

    try {
      await updateWatchlistStocks(watchlistId, newStocks)
    } catch (e) {
      // Revert on failure
      setWatchlists(prev => prev.map(w => w.id === watchlistId ? { ...w, stocks: list.stocks } : w))
      toast({ title: "Error", description: "Failed to add stock to watchlist", variant: "destructive" })
    }
  }

  const removeStock = async (watchlistId: string, ticker: string) => {
    const list = watchlists.find(w => w.id === watchlistId)
    if (!list || !list.stocks.includes(ticker)) return

    const newStocks = list.stocks.filter(s => s !== ticker)
    // Optimistic Update
    setWatchlists(prev => prev.map(w => w.id === watchlistId ? { ...w, stocks: newStocks } : w))

    try {
      await updateWatchlistStocks(watchlistId, newStocks)
    } catch (e) {
      // Revert on failure
      setWatchlists(prev => prev.map(w => w.id === watchlistId ? { ...w, stocks: list.stocks } : w))
      toast({ title: "Error", description: "Failed to remove stock", variant: "destructive" })
    }
  }

  const createWatchlist = async (name: string) => {
    if (!user?.email) return
    
    try {
      const newList = await createWatchlistDb(user.email, name, false)
      setWatchlists(prev => [...prev, newList])
    } catch (e) {
      toast({ title: "Error", description: "Failed to create watchlist", variant: "destructive" })
    }
  }

  const deleteWatchlist = async (id: string) => {
    const list = watchlists.find(w => w.id === id)
    if (!list) return

    // Optimistic Update
    setWatchlists(prev => prev.filter(w => w.id !== id))

    try {
      await deleteWatchlistDb(id)
    } catch (e) {
      // Revert
      setWatchlists(prev => [...prev, list])
      toast({ title: "Error", description: "Failed to delete watchlist", variant: "destructive" })
    }
  }

  const renameWatchlist = async (id: string, newName: string) => {
    const list = watchlists.find(w => w.id === id)
    if (!list) return

    // Optimistic Update
    setWatchlists(prev => prev.map(w => w.id === id ? { ...w, name: newName } : w))

    try {
      await renameWatchlistDb(id, newName)
    } catch (e) {
      // Revert
      setWatchlists(prev => prev.map(w => w.id === id ? { ...w, name: list.name } : w))
      toast({ title: "Error", description: "Failed to rename watchlist", variant: "destructive" })
    }
  }

  const isStockInWatchlist = (watchlistId: string, ticker: string) => {
    const list = watchlists.find(w => w.id === watchlistId)
    return list ? list.stocks.includes(ticker) : false
  }

  const getAllWatchlistsForStock = (ticker: string) => {
    return watchlists.filter(w => w.stocks.includes(ticker))
  }

  return (
    <WatchlistContext.Provider value={{ 
      watchlists, 
      addStock, 
      removeStock, 
      createWatchlist, 
      deleteWatchlist, 
      renameWatchlist,
      isStockInWatchlist,
      getAllWatchlistsForStock
    }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  const context = useContext(WatchlistContext)
  if (context === undefined) {
    throw new Error("useWatchlist must be used within a WatchlistProvider")
  }
  return context
}
