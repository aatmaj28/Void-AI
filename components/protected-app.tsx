"use client"

import React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/lib/user-context"

interface Props {
  children: React.ReactNode
}

/**
 * Client-side auth guard for all `(app)` routes.
 * If there is no logged-in user in `UserProvider`, redirect to `/login`.
 */
export function ProtectedApp({ children }: Props) {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (!isLoading && !user) {
      // Preserve where the user tried to go so we can redirect back after login
      const next = encodeURIComponent(pathname || "/dashboard")
      router.replace(`/login?next=${next}`)
    }
  }, [user, isLoading, router, pathname])

  if (isLoading || !user) {
    // Optional: show nothing while we decide; avoids flashing the app to guests
    return null
  }

  return <>{children}</>
}

