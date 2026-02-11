import { NextRequest, NextResponse } from "next/server"

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no}/{primary_doc}"

const FORMS = ["10-K", "10-Q", "8-K"]

type TickersResponse = Record<string, { cik_str: number; ticker: string; title: string }>

function buildFilingUrl(cik: string, accession: string, primaryDoc: string): string {
  const cikClean = String(Number(cik))
  const accClean = accession.replace(/-/g, "")
  return SEC_ARCHIVES_BASE.replace("{cik}", cikClean)
    .replace("{acc_no}", accClean)
    .replace("{primary_doc}", primaryDoc)
}

function filingTitle(form: string, filingDate: string): string {
  const year = filingDate.slice(0, 4)
  if (form === "10-K") return `Annual Report ${year}`
  if (form === "10-Q") return `Quarterly Report - ${filingDate}`
  if (form === "8-K") return `Current Report - ${filingDate}`
  return `${form} - ${filingDate}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker?.trim()) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 })
  }

  const ua = process.env.SEC_USER_AGENT?.trim()
  if (!ua) {
    return NextResponse.json(
      { error: "SEC_USER_AGENT not configured (required by SEC)" },
      { status: 500 }
    )
  }

  const headers = { "User-Agent": ua, Accept: "application/json" }
  const tickerUpper = ticker.toUpperCase()

  try {
    // Resolve ticker -> CIK from SEC company_tickers.json
    const tickersRes = await fetch(SEC_TICKERS_URL, { headers, next: { revalidate: 86400 } })
    if (!tickersRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch SEC company list" },
        { status: 502 }
      )
    }
    const tickersData = (await tickersRes.json()) as TickersResponse
    const entry = Object.values(tickersData).find(
      (e) => e.ticker?.toUpperCase() === tickerUpper
    )
    if (!entry) {
      return NextResponse.json(
        { error: `No SEC CIK found for ticker ${ticker}` },
        { status: 404 }
      )
    }

    const cik = String(entry.cik_str).padStart(10, "0")

    // Fetch company submissions (recent filings)
    const submissionsUrl = SEC_SUBMISSIONS_URL.replace("{cik}", cik)
    const submissionsRes = await fetch(submissionsUrl, { headers, next: { revalidate: 3600 } })
    if (!submissionsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch SEC filings" },
        { status: 502 }
      )
    }
    const submissions = await submissionsRes.json()
    const recent = submissions?.filings?.recent
    if (!recent) {
      return NextResponse.json({ filings: [] })
    }

    const forms = recent.form as string[]
    const dates = recent.filingDate as string[]
    const accessions = recent.accessionNumber as string[]
    const primaryDocs = recent.primaryDocument as string[]

    const filings: { type: string; date: string; title: string; url: string }[] = []
    const seen = new Set<string>()

    for (let i = 0; i < (forms?.length ?? 0); i++) {
      const form = forms[i]
      if (!FORMS.includes(form)) continue

      const key = `${form}-${dates[i]}-${accessions[i]}`
      if (seen.has(key)) continue
      seen.add(key)

      const accession = accessions[i]
      const primaryDoc = primaryDocs[i] ?? ""
      const filingDate = dates[i] ?? ""
      const url = buildFilingUrl(cik, accession, primaryDoc)
      filings.push({
        type: form,
        date: filingDate,
        title: filingTitle(form, filingDate),
        url,
      })
    }

    // Sort by date descending and limit to a reasonable number
    filings.sort((a, b) => b.date.localeCompare(a.date))
    const limited = filings.slice(0, 20)

    return NextResponse.json({ filings: limited })
  } catch (e) {
    console.error("SEC filings error:", e)
    return NextResponse.json(
      { error: "Failed to load SEC filings" },
      { status: 500 }
    )
  }
}
