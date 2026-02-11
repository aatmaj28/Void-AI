import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 })
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const [companiesRes, metricsRes, coverageRes, scoresRes] = await Promise.all([
      supabase.from("companies").select("*").eq("ticker", ticker.toUpperCase()).single(),
      supabase.from("stock_metrics").select("*").eq("ticker", ticker.toUpperCase()).single(),
      supabase.from("analyst_coverage").select("*").eq("ticker", ticker.toUpperCase()).single(),
      supabase.from("coverage_gap_scores").select("*").eq("ticker", ticker.toUpperCase()).single(),
    ])

    const company = companiesRes.data
    const metrics = metricsRes.data
    const coverage = coverageRes.data
    const scores = scoresRes.data

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const price = (metrics?.current_price as number) ?? 0
    const changePct = (metrics?.price_change_1m as number) ?? 0
    const change = price * changePct

    return NextResponse.json({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      market_cap: company.market_cap,
      current_price: price,
      price_change_1m: changePct,
      change,
      changePercent: changePct * 100,
      avg_volume_20d: metrics?.avg_volume_20d,
      volume: metrics?.volume ?? null,
      pe_ratio: metrics?.pe_ratio ?? null,
      year_high: metrics?.year_high,
      year_low: metrics?.year_low,
      analyst_count: coverage?.analyst_count ?? 0,
      gap_score: scores?.gap_score ?? 0,
      activity_score: scores?.activity_score ?? 0,
      quality_score: scores?.quality_score ?? 0,
      coverage_score: scores?.coverage_score ?? 0,
      opportunity_type: scores?.opportunity_type ?? "Low Priority",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}
