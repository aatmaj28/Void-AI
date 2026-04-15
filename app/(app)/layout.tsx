import React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Footer } from "@/components/footer"
import { ProtectedApp } from "@/components/protected-app"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedApp>
      <AppSidebar>
        <main className="flex-1 min-h-screen">{children}</main>
      </AppSidebar>
    </ProtectedApp>
  )
}
