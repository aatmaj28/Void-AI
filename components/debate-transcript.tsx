"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronRight, Brain, BarChart3, Search, Target, Shield, Newspaper } from "lucide-react"

interface DebateStep {
    agent: string
    role: string
    summary: string
    fullOutput: string
}

interface NewsItem {
    headline: string
    source: string
    datetime: string
    url: string
}

interface DebateTranscriptProps {
    steps: DebateStep[]
    newsContext?: NewsItem[]
    generatedAt?: string
    modelUsed?: string
}

const agentIcons: Record<string, typeof Brain> = {
    "Data Analyst": BarChart3,
    "Coverage Specialist": Search,
    "Fundamental Analyst": Brain,
    "Strategist": Target,
    "Devil's Advocate": Shield,
}

const agentColors: Record<string, string> = {
    "Data Analyst": "text-blue-400 bg-blue-400/10 border-blue-400/20",
    "Coverage Specialist": "text-purple-400 bg-purple-400/10 border-purple-400/20",
    "Fundamental Analyst": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    "Strategist": "text-amber-400 bg-amber-400/10 border-amber-400/20",
    "Devil's Advocate": "text-red-400 bg-red-400/10 border-red-400/20",
}

const agentDotColors: Record<string, string> = {
    "Data Analyst": "bg-blue-400",
    "Coverage Specialist": "bg-purple-400",
    "Fundamental Analyst": "bg-emerald-400",
    "Strategist": "bg-amber-400",
    "Devil's Advocate": "bg-red-400",
}

export function DebateTranscript({ steps, newsContext, generatedAt, modelUsed }: DebateTranscriptProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [expandedStep, setExpandedStep] = useState<number | null>(null)

    if (!steps || steps.length === 0) return null

    const formattedDate = generatedAt
        ? new Date(generatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
        : null

    return (
        <div className="mt-6 rounded-lg border border-border/50 bg-card/50 overflow-hidden">
            {/* Header — click to expand/collapse */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <Brain className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-foreground">
                            How This Analysis Was Built
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {steps.length} AI agents analyzed in sequence
                            {formattedDate && ` · ${formattedDate}`}
                            {modelUsed && ` · ${modelUsed.split("/").pop()}`}
                        </p>
                    </div>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            {/* Expanded content */}
            {isOpen && (
                <div className="px-4 pb-4">
                    {/* Agent steps timeline */}
                    <div className="relative ml-4 border-l border-border/50">
                        {steps.map((step, index) => {
                            const Icon = agentIcons[step.agent] || Brain
                            const colorClass = agentColors[step.agent] || "text-gray-400 bg-gray-400/10 border-gray-400/20"
                            const dotColor = agentDotColors[step.agent] || "bg-gray-400"
                            const isExpanded = expandedStep === index

                            return (
                                <div key={index} className="relative pl-8 pb-6 last:pb-2">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full ${dotColor} -translate-x-[5.5px] ring-2 ring-background`} />

                                    {/* Step header */}
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Step {index + 1}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                                            <Icon className="w-3 h-3" />
                                            {step.agent}
                                        </span>
                                    </div>

                                    {/* Role label */}
                                    <p className="text-xs text-muted-foreground mb-2">
                                        {step.role}
                                    </p>

                                    {/* Summary box */}
                                    <div className="rounded-md border border-border/40 bg-muted/20 p-3">
                                        <p className="text-sm text-foreground/80 leading-relaxed">
                                            {step.summary}
                                        </p>

                                        {/* Show full toggle */}
                                        {step.fullOutput && step.fullOutput !== step.summary && (
                                            <button
                                                onClick={() => setExpandedStep(isExpanded ? null : index)}
                                                className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        Hide full output
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronRight className="w-3 h-3" />
                                                        Show full output
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Full output (expanded) */}
                                        {isExpanded && step.fullOutput && (
                                            <div className="mt-3 pt-3 border-t border-border/30">
                                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-sans">
                                                    {step.fullOutput}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* News sources used */}
                    {newsContext && newsContext.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/30">
                            <div className="flex items-center gap-2 mb-2">
                                <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                    News sources used ({newsContext.length})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {newsContext.map((news, i) => (
                                    <a
                                        key={i}
                                        href={news.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                    >
                                        {news.source} · {news.datetime}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}