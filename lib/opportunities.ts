/**
 * Types and fetch for opportunities (companies + metrics + analyst_coverage + coverage_gap_scores).
 * Used by dashboard, opportunities, screener, stock detail.
 */

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

/** UI-friendly shape (matches former mock Stock where possible) */
export type Opportunity = {
  ticker: string
  company: string
  sector: string
  industry: string
  marketCap: number
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  analystCount: number
  gapScore: number
  activityScore: number
  opportunityType: string
  high52w: number
  low52w: number
  priceHistory: number[]
}

function rowToOpportunity(row: OpportunityRow): Opportunity {
  const price = row.current_price ?? 0
  const changePct = row.price_change_1m ?? 0
  const change = price * changePct
  return {
    ticker: row.ticker,
    company: row.name ?? row.ticker,
    sector: row.sector ?? "Unknown",
    industry: row.industry ?? "",
    marketCap: row.market_cap ?? 0,
    price,
    change,
    changePercent: changePct * 100,
    volume: row.volume ?? 0,
    avgVolume: row.avg_volume_20d ?? 0,
    analystCount: row.analyst_count ?? 0,
    gapScore: Math.round(row.gap_score ?? 0),
    activityScore: Math.round(row.activity_score ?? 0),
    opportunityType: row.opportunity_type ?? "Low Priority",
    high52w: row.year_high ?? 0,
    low52w: row.year_low ?? 0,
    priceHistory: [],
  }
}

export async function fetchOpportunities(): Promise<Opportunity[]> {
  const res = await fetch("/api/opportunities", { cache: "no-store" })
  if (!res.ok) {
    throw new Error(res.status === 500 ? (await res.json().then((b) => b.error).catch(() => "Server error")) : res.statusText)
  }
  const data = (await res.json()) as OpportunityRow[]
  return data.map(rowToOpportunity)
}
