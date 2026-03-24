import { supabase } from "@/lib/supabase"

export interface Alert {
  id: string
  user_email: string
  ticker: string
  type: string
  severity: "high" | "medium" | "low"
  title: string
  message: string
  read: boolean
  created_at: string
}

export interface AlertSettings {
  user_email: string
  gap_increase: boolean
  volume_spike: boolean
  new_opportunity: boolean
  coverage_change: boolean
  price_movement: boolean
  email_notifications: boolean
  gap_threshold: number
  volume_threshold: number
}

// Fetch all alerts for a given user email
export async function fetchUserAlerts(email: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_email", email)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching alerts:", error)
    return []
  }

  return data as Alert[]
}

// Fetch unread alerts count for a given user email
export async function fetchUnreadAlertsCount(email: string): Promise<number> {
  const { count, error } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email)
    .eq("read", false)

  if (error) {
    console.error("Error fetching unread alerts count:", error)
    return 0
  }

  return count || 0
}

// Mark a single alert as read
export async function markAlertAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ read: true })
    .eq("id", id)

  if (error) {
    console.error("Error marking alert as read:", error)
    throw error
  }
}

// Mark all alerts as read for a user
export async function markAllAlertsAsRead(email: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ read: true })
    .eq("user_email", email)
    .eq("read", false)

  if (error) {
    console.error("Error marking all alerts as read:", error)
    throw error
  }
}

// Delete a single alert
export async function removeAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting alert:", error)
    throw error
  }
}

// Delete all read alerts for a user
export async function clearReadAlerts(email: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("user_email", email)
    .eq("read", true)

  if (error) {
    console.error("Error clearing read alerts:", error)
    throw error
  }
}

// Fetch user alert settings
export async function fetchUserAlertSettings(email: string): Promise<AlertSettings | null> {
  const { data, error } = await supabase
    .from("alert_settings")
    .select("*")
    .eq("user_email", email)
    .single()

  if (error) {
    if (error.code !== "PGRST116") { // not found error
      console.error("Error fetching alert settings:", error)
    }
    return null
  }

  return data as AlertSettings
}

// Upsert user alert settings
export async function updateAlertSettings(settings: AlertSettings): Promise<void> {
  const { error } = await supabase
    .from("alert_settings")
    .upsert(
      {
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    )

  if (error) {
    console.error("Error updating alert settings:", error)
    throw error
  }
}
