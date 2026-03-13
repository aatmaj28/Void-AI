/**
 * RAG Chat API client
 * 
 * Calls the FastAPI RAG service for both focused (ticker-specific)
 * and global (cross-universe) chat queries.
 * 
 * Set NEXT_PUBLIC_RAG_API_URL in .env.local:
 *   - Local dev: http://localhost:8000
 *   - Production: https://your-railway-app.up.railway.app
 */

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8000"

export type ChatMessage = {
    role: "user" | "assistant"
    content: string
}

export type SourceDocument = {
    ticker: string
    source_type: string  // "stock_profile" | "sec_filing" | "web"
    form_type: string | null
    section: string | null
    snippet: string
    url: string | null
}

export type ChatResponse = {
    reply: string
    mode: "focused" | "global"
    ticker: string | null
    sources: SourceDocument[]
}

/**
 * Send a chat message to the RAG API.
 * 
 * @param message - The user's question
 * @param ticker - Stock ticker for focused mode, or null for global mode
 * @param history - Previous messages in this session
 * @returns ChatResponse with reply and source documents
 */
export async function sendChatMessage(
    message: string,
    ticker: string | null,
    history: ChatMessage[] = []
): Promise<ChatResponse> {
    const response = await fetch(`${RAG_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            ticker,
            history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
            errorData?.detail || `RAG API error: ${response.status} ${response.statusText}`
        )
    }

    return response.json()
}

/**
 * Send a chat message to the RAG API and receive a streaming response.
 */
export async function sendChatMessageStream(
    message: string,
    ticker: string | null,
    history: ChatMessage[],
    onToken: (token: string) => void,
    onSources: (sources: SourceDocument[]) => void,
    onDone: () => void,
    onError: (error: string) => void,
) {
    try {
        const response = await fetch(`${RAG_API_URL}/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                ticker,
                history: history.map((m) => ({ role: m.role, content: m.content })),
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(
                errorData?.detail || `RAG API error: ${response.status} ${response.statusText}`
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
            // The last element is either an incomplete line or an empty string, keep it in buffer
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
                        if (parsed.token) onToken(parsed.token)
                        if (parsed.sources) onSources(parsed.sources)
                        if (parsed.error) onError(parsed.error)
                    } catch (e) {
                        // ignore JSON parse error on incomplete chunks if any somehow get here
                    }
                }
            }
        }
        onDone()
    } catch (error) {
        onError(error instanceof Error ? error.message : "Stream error")
    }
}