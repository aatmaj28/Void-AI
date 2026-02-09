import { NextRequest, NextResponse } from "next/server"

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

type FinnhubNewsItem = {
  category: string
  datetime: number
  headline: string
  id: number
  image: string
  related: string
  source: string
  summary: string
  url: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 })
  }
  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 })
  }

  try {
    const today = new Date()
    const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const qs = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
      token: FINNHUB_API_KEY,
    })

    const res = await fetch(`https://finnhub.io/api/v1/company-news?${qs.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
      // 10s timeout via AbortController is overkill here; rely on platform timeout
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Finnhub error: ${res.status}`, body: text.slice(0, 200) },
        { status: 502 }
      )
    }

    const data = (await res.json()) as FinnhubNewsItem[]

    // Normalize and limit to 5 items
    const normalized = data
      .filter((item) => item.headline && item.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        source: item.source,
        headline: item.headline,
        url: item.url,
        datetime: item.datetime,
        summary: item.summary,
        image: item.image || null,
      }))

    const response = NextResponse.json(normalized)
    // Allow edge caching for 10 minutes; news will still be fresh intra-day.
    response.headers.set("Cache-Control", "s-maxage=600, stale-while-revalidate=300")
    return response
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}

