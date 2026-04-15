import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Fetch the latest backtest summary
    const { data: summaries, error: sumErr } = await supabase
      .from("backtest_summary")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(10)

    if (sumErr) {
      // Table might not exist yet
      return NextResponse.json({
        summaries: [],
        quintileResults: [],
        error: sumErr.message.includes("does not exist")
          ? "Backtest tables not created yet. Run migration 018."
          : sumErr.message,
      })
    }

    // Fetch the latest quintile results (from the most recent run)
    const { data: results, error: resErr } = await supabase
      .from("backtest_results")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(100)

    if (resErr) {
      return NextResponse.json({
        summaries: summaries || [],
        quintileResults: [],
        error: resErr.message,
      })
    }

    return NextResponse.json({
      summaries: summaries || [],
      quintileResults: results || [],
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
