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
  volume: number | null
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
    async function fetchAll(tableName: string, selectFields: string) {
      let allData: any[] = []
      let pageSize = 1000
      let offset = 0
      while (true) {
        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .range(offset, offset + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allData = [...allData, ...data]
        if (data.length < pageSize) break
        offset += pageSize
      }
      return allData
    }

    const [companies, metrics, coverage, scores] = await Promise.all([
      fetchAll("companies", "ticker, name, sector, industry, market_cap"),
      fetchAll("stock_metrics", "ticker, current_price, price_change_1m, avg_volume_20d, year_high, year_low, volume"),
      fetchAll("analyst_coverage", "ticker, analyst_count"),
      fetchAll("coverage_gap_scores", "ticker, gap_score, activity_score, quality_score, coverage_score, opportunity_type"),
    ])

    const metricsByTicker = Object.fromEntries(metrics.map((m) => [m.ticker, m]))
    const coverageByTicker = Object.fromEntries(coverage.map((c) => [c.ticker, c]))
    const scoresByTicker = Object.fromEntries(scores.map((s) => [s.ticker, s]))

    const merged: OpportunityRow[] = companies
      .filter((c) => scoresByTicker[c.ticker] && (metricsByTicker[c.ticker]?.current_price ?? 0) > 0)
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
          volume: m?.volume ?? null,
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
