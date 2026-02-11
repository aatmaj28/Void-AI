import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const DEFAULT_DAYS = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker?.trim()) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 })
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(365, Math.max(5, parseInt(searchParams.get("days") ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS))

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { data, error } = await supabase
      .from("market_data")
      .select("date, volume, close")
      .eq("ticker", ticker.toUpperCase())
      .order("date", { ascending: false })
      .limit(days)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const series = (data ?? []).map((row) => ({
      date: row.date,
      volume: Number(row.volume) || 0,
      close: row.close != null ? Number(row.close) : null,
    })).reverse()

    return NextResponse.json({ data: series })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}
