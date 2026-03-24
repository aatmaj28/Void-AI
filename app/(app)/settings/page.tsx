"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Key,
  Lock,
  LogOut,
  Moon,
  Sun,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/lib/user-context"

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, isLoading: userLoading, logout } = useUser()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash === "#api") {
      requestAnimationFrame(() => {
        document.getElementById("api")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }, [])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email) return

    setPwError("")
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match")
      return
    }

    setPwSaving(true)
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          currentPassword,
          newPassword,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to change password")
      }
      setPwSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setTimeout(() => setPwSuccess(false), 4000)
      setTimeout(() => {
        setPasswordFormOpen(false)
      }, 1800)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setPwSaving(false)
    }
  }

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center max-w-lg">
        <p className="text-muted-foreground">Please log in to view settings.</p>
        <Button className="mt-4" onClick={() => router.push("/login")}>
          Go to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Preferences and account shortcuts</p>
        </div>
      </div>

      <div className="space-y-6">
        <section className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Account
          </h2>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-5 mb-1">
            <p className="text-sm text-muted-foreground">Forgot your password?</p>
            <p className="text-sm font-medium text-foreground mt-0.5">We&apos;ve got you.</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">
              Use your current password below to set a new one.
            </p>
            {!passwordFormOpen && (
              <Button
                type="button"
                className="mt-4"
                onClick={() => {
                  setPwError("")
                  setPwSuccess(false)
                  setPasswordFormOpen(true)
                }}
              >
                Change password
              </Button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {passwordFormOpen && (
              <motion.div
                key="password-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-4 pt-5 mt-1 border-t border-border/70"
                >
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-11 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 pr-10"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 pr-10"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {pwError && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div className="text-sm text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      Password updated successfully.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit" disabled={pwSaving}>
                      {pwSaving ? "Updating…" : "Update password"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setPasswordFormOpen(false)
                        setPwError("")
                        setPwSuccess(false)
                        setCurrentPassword("")
                        setNewPassword("")
                        setConfirmPassword("")
                        setShowCurrentPassword(false)
                        setShowNewPassword(false)
                        setShowConfirmPassword(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">End your session on this device.</p>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4">App</h2>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            <Link
              href="/alerts"
              className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-medium block">Alerts</span>
                  <span className="text-sm text-muted-foreground">
                    Notification types, thresholds, and email delivery
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-medium block">Profile</span>
                  <span className="text-sm text-muted-foreground">
                    Name on your account, contact info, and bio
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-2">Appearance</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Same as the sun / moon control in the top bar.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            disabled={!mounted}
          >
            {mounted && theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" />
                Switch to light mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                Switch to dark mode
              </>
            )}
          </Button>
        </section>

        <section
          id="api"
          className="bg-card border border-border rounded-2xl p-6 shadow-lg scroll-mt-24"
        >
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            API keys
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Market data and AI calls use keys stored securely on the server, so you do not need to
            paste your own keys to use VOID.AI. If we add optional integrations later (for example,
            bring-your-own model keys or a public API for power users), you would manage them here.
          </p>
        </section>
      </div>
    </div>
  )
}
