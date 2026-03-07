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
    source_type: string
    form_type: string | null
    section: string | null
    snippet: string
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