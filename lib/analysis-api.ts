/**
 * AI Analysis API client
 *
 * Calls the FastAPI RAG service for CrewAI-generated investment analysis.
 * Endpoints:
 *   GET  /analysis/{ticker}  — fetch cached analysis
 *   POST /analyze/{ticker}   — generate new analysis (force=true to bypass cache)
 *
 * Set NEXT_PUBLIC_RAG_API_URL in .env.local:
 *   - Local dev: http://localhost:8000
 *   - Production: https://your-railway-app.up.railway.app
 */

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8000"

// --- Types ---

export interface DebateStep {
    agent: string
    role: string
    summary: string
    fullOutput: string
}

export interface NewsItem {
    headline: string
    summary: string
    source: string
    datetime: string
    url: string
}

export interface AnalysisData {
    ticker: string
    hypothesis: string
    confidence: number
    bullCase: { title: string; points: string[] }
    baseCase: { title: string; points: string[] }
    bearCase: { title: string; points: string[] }
    catalysts: { event: string; date: string }[]
    risks: { risk: string; severity: "high" | "medium" | "low" }[]
    debateTranscript: DebateStep[]
    newsContext: NewsItem[]
    generatedAt: string
    modelUsed: string
    isStale: boolean
}

// --- API Functions ---

/**
 * Fetch cached AI analysis for a ticker.
 * Returns null if no analysis exists (404).
 */
export async function getAnalysis(ticker: string): Promise<AnalysisData | null> {
    try {
        const response = await fetch(`${RAG_API_URL}/analysis/${ticker.toUpperCase()}`)

        if (response.status === 404) {
            return null
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(
                errorData?.detail || `Analysis API error: ${response.status} ${response.statusText}`
            )
        }

        return response.json()
    } catch (error) {
        // Network error or service down — return null so UI shows generate button
        if (error instanceof TypeError && error.message.includes("fetch")) {
            console.warn("Analysis API unreachable:", error.message)
            return null
        }
        throw error
    }
}

/**
 * Generate AI analysis for a ticker using CrewAI agents.
 * Takes ~15-30 seconds for a fresh generation.
 *
 * @param ticker - Stock ticker symbol
 * @param force - If true, bypass cache and regenerate
 */
export async function generateAnalysis(
    ticker: string,
    force: boolean = false
): Promise<AnalysisData> {
    const url = `${RAG_API_URL}/analyze/${ticker.toUpperCase()}${force ? "?force=true" : ""}`

    const response = await fetch(url, {
        method: "POST",
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
            errorData?.detail || `Analysis generation failed: ${response.status} ${response.statusText}`
        )
    }

    return response.json()
}

// --- Streaming types ---

export interface StreamingTask {
    agent: string
    role: string
    phase: string
    output: string
    summary: string
    taskIndex: number
    totalTasks: number
}

/**
 * Generate AI analysis with SSE streaming — yields each agent's output live.
 * Calls the /analyze/{ticker}/stream endpoint.
 */
export async function generateAnalysisStream(
    ticker: string,
    force: boolean = false,
    onTask: (task: StreamingTask) => void,
    onAnalysis: (analysis: AnalysisData) => void,
    onDone: () => void,
    onError: (error: string) => void,
) {
    const url = `${RAG_API_URL}/analyze/${ticker.toUpperCase()}/stream${force ? "?force=true" : ""}`

    try {
        const response = await fetch(url, { method: "POST" })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(
                errorData?.detail || `Analysis stream failed: ${response.status} ${response.statusText}`
            )
        }

        if (!response.body) throw new Error("ReadableStream not supported")

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (let line of lines) {
                line = line.trim()
                if (line.startsWith("data: ")) {
                    const data = line.slice(6)
                    if (data === "[DONE]") {
                        onDone()
                        return
                    }
                    try {
                        const parsed = JSON.parse(data)
                        if (parsed.type === "task") {
                            onTask(parsed as StreamingTask)
                        } else if (parsed.type === "analysis") {
                            onAnalysis(parsed as AnalysisData)
                        } else if (parsed.type === "error") {
                            onError(parsed.message || "Unknown error")
                        }
                    } catch {
                        // ignore JSON parse error on incomplete chunks
                    }
                }
            }
        }
        onDone()
    } catch (error) {
        onError(error instanceof Error ? error.message : "Stream error")
    }
}