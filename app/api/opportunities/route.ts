import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export type OpportunityRow = {
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  market_cap: number | null
  current_price: number | null
  price_change_1m: number | null
  avg_volume_20d: number | null
  year_high: number | null
  year_low: number | null
  analyst_count: number
  gap_score: number
  activity_score: number
  quality_score: number
  coverage_score: number
  opportunity_type: string | null
}

export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    )
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const [companiesRes, metricsRes, coverageRes, scoresRes] = await Promise.all([
      supabase.from("companies").select("ticker, name, sector, industry, market_cap"),
      supabase.from("stock_metrics").select("ticker, current_price, price_change_1m, avg_volume_20d, year_high, year_low"),
      supabase.from("analyst_coverage").select("ticker, analyst_count"),
      supabase.from("coverage_gap_scores").select("ticker, gap_score, activity_score, quality_score, coverage_score, opportunity_type"),
    ])

    if (companiesRes.error || metricsRes.error || coverageRes.error || scoresRes.error) {
      const err = companiesRes.error || metricsRes.error || coverageRes.error || scoresRes.error
      return NextResponse.json({ error: err?.message ?? "Supabase error" }, { status: 500 })
    }

    const companies = (companiesRes.data ?? []) as { ticker: string; name: string | null; sector: string | null; industry: string | null; market_cap: number | null }[]
    const metrics = (metricsRes.data ?? []) as { ticker: string; current_price: number | null; price_change_1m: number | null; avg_volume_20d: number | null; year_high: number | null; year_low: number | null }[]
    const coverage = (coverageRes.data ?? []) as { ticker: string; analyst_count: number }[]
    const scores = (scoresRes.data ?? []) as { ticker: string; gap_score: number; activity_score: number; quality_score: number; coverage_score: number; opportunity_type: string | null }[]

    const metricsByTicker = Object.fromEntries(metrics.map((m) => [m.ticker, m]))
    const coverageByTicker = Object.fromEntries(coverage.map((c) => [c.ticker, c]))
    const scoresByTicker = Object.fromEntries(scores.map((s) => [s.ticker, s]))

    const merged: OpportunityRow[] = companies
      .filter((c) => scoresByTicker[c.ticker])
      .map((c) => {
        const m = metricsByTicker[c.ticker]
        const cov = coverageByTicker[c.ticker]
        const s = scoresByTicker[c.ticker]
        return {
          ticker: c.ticker,
          name: c.name ?? null,
          sector: c.sector ?? null,
          industry: c.industry ?? null,
          market_cap: c.market_cap ?? null,
          current_price: m?.current_price ?? null,
          price_change_1m: m?.price_change_1m ?? null,
          avg_volume_20d: m?.avg_volume_20d ?? null,
          year_high: m?.year_high ?? null,
          year_low: m?.year_low ?? null,
          analyst_count: cov?.analyst_count ?? 0,
          gap_score: s?.gap_score ?? 0,
          activity_score: s?.activity_score ?? 0,
          quality_score: s?.quality_score ?? 0,
          coverage_score: s?.coverage_score ?? 0,
          opportunity_type: s?.opportunity_type ?? null,
        }
      })

    return NextResponse.json(merged)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}
