"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Search,
  Sun,
  Moon,
  Bell,
  User,
  Settings,
  LogOut,
  Key,
  LayoutDashboard,
  TrendingUp,
  Filter,
  Star,
  AlertCircle,
  Menu,
  X,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: TrendingUp },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/explore", label: "Explore & Chat", icon: MessageSquare },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/alerts", label: "Alerts", icon: AlertCircle },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, logout, isLoading } = useUser()
  const [mounted, setMounted] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [unreadAlerts] = React.useState(3)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [allStocks, setAllStocks] = React.useState<Opportunity[]>([])
  const [searchResults, setSearchResults] = React.useState<Opportunity[]>([])
  const [showResults, setShowResults] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Load all opportunities once for client-side search
  React.useEffect(() => {
    fetchOpportunities()
      .then(setAllStocks)
      .catch(() => {
        // fail silently; search just won't show suggestions
      })
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (!value.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const q = value.toLowerCase()
    const matches = allStocks
      .filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.company.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q)
      )
      .slice(0, 8)
    setSearchResults(matches)
    setShowResults(matches.length > 0)
  }

  const navigateToTicker = (ticker: string) => {
    setSearchQuery("")
    setShowResults(false)
    router.push(`/stock/${ticker}`)
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Logo */}
        <Logo />

        {/* Center: Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: Search, Theme, Notifications, User */}
        <div className="flex items-center gap-2">
          {/* Search - Desktop */}
          <div className="hidden lg:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              type="search"
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true)
              }}
              onBlur={() => {
                // delay to allow click on suggestions
                setTimeout(() => setShowResults(false), 150)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  navigateToTicker(searchResults[0].ticker)
                }
              }}
              className="w-64 pl-9 pr-12 bg-secondary border-none"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-20 rounded-md border border-border bg-popover shadow-md">
                <ul className="max-h-72 overflow-y-auto text-sm">
                  {searchResults.map((stock) => (
                    <li key={stock.ticker}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => navigateToTicker(stock.ticker)}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-secondary text-left"
                      >
                        <div>
                          <div className="font-mono font-semibold">{stock.ticker}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {stock.company}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{stock.sector}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Gap {stock.gapScore} · Act {stock.activityScore}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )
            ) : (
              <div className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/alerts">
              <Bell className="h-5 w-5" />
              {unreadAlerts > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                  {unreadAlerts}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-cyan flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">
                  {user ? `${user.firstName} ${user.lastName}` : "Guest"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || "Not logged in"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings#api" className="cursor-pointer">
                  <Key className="mr-2 h-4 w-4" />
                  API Keys
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-border bg-background px-4 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
