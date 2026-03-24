"use server"

import { createClient } from "@supabase/supabase-js"
import { Watchlist } from "./mock-data"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
})

export async function fetchWatchlists(userEmail: string): Promise<Watchlist[]> {
  const { data, error } = await supabase
    .from("watchlists")
    .select("id, name, is_general, stocks, created_at")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: true })

  if (error) {
    if (error.code === '42P01') {
      return [] // Table doesn't exist yet
    }
    console.error("Error fetching watchlists:", error)
    throw new Error(error.message)
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    stocks: row.stocks,
    createdAt: new Date(row.created_at)
  }))
}

export async function createWatchlistDb(userEmail: string, name: string, isGeneral: boolean = false): Promise<Watchlist> {
  const { data, error } = await supabase
    .from("watchlists")
    .insert([
      { user_email: userEmail, name, is_general: isGeneral }
    ])
    .select("id, name, stocks, created_at")
    .single()

  if (error) throw new Error(error.message)
  
  return {
    id: data.id,
    name: data.name,
    stocks: data.stocks,
    createdAt: new Date(data.created_at)
  }
}

export async function updateWatchlistStocks(id: string, stocks: string[]) {
  const { error } = await supabase
    .from("watchlists")
    .update({ stocks, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
}

export async function deleteWatchlistDb(id: string) {
  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

export async function renameWatchlistDb(id: string, name: string) {
  const { error } = await supabase
    .from("watchlists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
}
