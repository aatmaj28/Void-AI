"use client"

import Link from "next/link"

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-8 w-8"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="url(#logoGradient)"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M10 18 L14 12 L18 16 L22 10"
          stroke="url(#logoGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="font-semibold text-lg tracking-tight">
        <span className="text-foreground">VOID</span>
        <span className="text-primary">.AI</span>
      </span>
    </Link>
  )
}
