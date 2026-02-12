import React from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ProtectedApp } from "@/components/protected-app"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedApp>
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ProtectedApp>
  )
}

