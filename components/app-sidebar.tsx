"use client"

import * as React from "react"
import { Sidebar } from "@/components/sidebar"

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)

  // Listen for sidebar collapse state changes via a custom event
  // (The Sidebar component manages its own collapsed state internally,
  //  but the content area needs to know to adjust its margin)
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector("aside")
      if (sidebar) {
        const width = sidebar.getBoundingClientRect().width
        setCollapsed(width < 100)
      }
    })

    const sidebar = document.querySelector("aside")
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ["class"] })
      // Set initial state
      setCollapsed(sidebar.getBoundingClientRect().width < 100)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div
        className="flex-1 flex flex-col"
        style={{ marginLeft: collapsed ? 68 : 240 }}
      >
        {children}
      </div>
    </div>
  )
}
