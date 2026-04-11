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
    const { data, error } = await supabase
      .from("llm_validations")
      .select("ticker, gap_score, adjusted_gap_score, original_category, agreement_score, reasoning, red_flags, suggested_category, model_used, validated_at")
      .eq("ticker", ticker.toUpperCase())
      .order("validated_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ validation: null })
    }

    let redFlagsParsed: string[] = []
    try {
      if (typeof data.red_flags === "string") {
        redFlagsParsed = JSON.parse(data.red_flags)
      } else if (Array.isArray(data.red_flags)) {
        redFlagsParsed = data.red_flags
      }
    } catch {
      if (data.red_flags) redFlagsParsed = [String(data.red_flags)]
    }

    return NextResponse.json({
      validation: {
        ticker: data.ticker,
        originalScore: data.gap_score,
        adjustedScore: data.adjusted_gap_score,
        originalCategory: data.original_category,
        suggestedCategory: data.suggested_category,
        agreementScore: data.agreement_score,
        reasoning: data.reasoning,
        redFlags: redFlagsParsed,
        model: data.model_used,
        validatedAt: data.validated_at,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
