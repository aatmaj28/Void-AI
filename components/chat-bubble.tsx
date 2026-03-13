"use client"

import ReactMarkdown from "react-markdown"

/**
 * Chat message bubble with markdown rendering.
 * Renders assistant messages with proper formatting (bold, lists, etc.)
 * and user messages as plain text.
 */
export function ChatBubble({
    role,
    content,
    hasWebSources,
}: {
    role: "user" | "assistant"
    content: string
    hasWebSources?: boolean
}) {
    const isUser = role === "user"

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
            >
                {!isUser && hasWebSources && (
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-green-400">
                            Live Web Search
                        </span>
                    </div>
                )}
                {isUser ? (
                    <p>{content}</p>
                ) : (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:ml-4 [&>ol]:mb-2 [&>ol]:ml-4 [&>li]:mb-0.5">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Thinking/loading indicator bubble
 */
export function ThinkingBubble() {
    return (
        <div className="flex justify-start">
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Thinking...
            </div>
        </div>
    )
}