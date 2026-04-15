"use server"

import { createClient } from "@supabase/supabase-js"

// Use Server-side environment variables
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Condition {
  id: string
  metric: string
  operator: string
  value: string
}

export interface SavedScreen {
  id: string
  user_email?: string
  name: string
  description: string | null
  tags: string[]
  conditions: Condition[]
  created_at: string
  updated_at?: string
}

export async function fetchSavedScreens(userEmail: string): Promise<SavedScreen[]> {
  if (!supabaseUrl) return []

  const { data, error } = await supabase
    .from("saved_screens")
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching saved screens:", error)
    return [] 
  }

  return data as SavedScreen[]
}

export async function saveScreen(
  userEmail: string,
  screen: Omit<SavedScreen, "id" | "user_email" | "created_at" | "updated_at">
): Promise<SavedScreen> {
  if (!supabaseUrl) throw new Error("Supabase internal error")

  const { data, error } = await supabase
    .from("saved_screens")
    .insert([
      {
        user_email: userEmail,
        name: screen.name,
        description: screen.description,
        tags: screen.tags,
        conditions: screen.conditions,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("Error saving screen:", error)
    throw new Error(error.message ?? "Failed to save screen")
  }

  return data as SavedScreen
}

export async function deleteScreen(id: string): Promise<void> {
  const { error } = await supabase.from("saved_screens").delete().eq("id", id)

  if (error) {
    console.error("Error deleting screen:", error)
    throw new Error(error.message ?? "Failed to delete screen")
  }
}
