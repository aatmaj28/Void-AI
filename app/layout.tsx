import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const metadata: Metadata = {
  title: "Void AI - We Find Alpha in the Void",
  description:
    "AI-powered stock research platform that identifies under-covered investment opportunities by finding stocks with high market activity but minimal analyst coverage.",
  generator: "v0.app",
  keywords: [
    "stock research",
    "AI investing",
    "alpha generation",
    "coverage gap",
    "investment opportunities",
  ],
  authors: [
    { name: "Aatmaj Amol Salunke", url: "mailto:salunke.aa@northeastern.edu" },
    { name: "Vijwal Mahendrakar", url: "mailto:mahendrakar.v@northeastern.edu" },
  ],
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
