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
  MessageSquare,
  Coins,
  Briefcase,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
  GitCompare,
  ChevronDown,
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
import { cn } from "@/lib/utils"
import { fetchUnreadAlertsCount } from "@/lib/alerts-api"
import { useUser } from "@/lib/user-context"
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities"

type NavSection = {
  title: string
  items: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
  }[]
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Research",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: TrendingUp },
      { href: "/screener", label: "Screener", icon: Filter },
      { href: "/explore", label: "Explore & Chat", icon: MessageSquare },
      { href: "/compare", label: "Compare", icon: GitCompare },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { href: "/portfolio", label: "My Stocks", icon: Briefcase },
      { href: "/watchlist", label: "Watchlist", icon: Star },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/backtest", label: "Signal Validation", icon: FlaskConical },
      { href: "/alerts", label: "Alerts", icon: AlertCircle },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useUser()
  const [mounted, setMounted] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const [unreadAlerts, setUnreadAlerts] = React.useState(0)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [allStocks, setAllStocks] = React.useState<Opportunity[]>([])
  const [searchResults, setSearchResults] = React.useState<Opportunity[]>([])
  const [showResults, setShowResults] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    if (user?.email) {
      fetchUnreadAlertsCount(user.email).then((count) => setUnreadAlerts(count))
      const interval = setInterval(() => {
        fetchUnreadAlertsCount(user.email).then((count) => setUnreadAlerts(count))
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [user?.email, pathname])

  React.useEffect(() => {
    fetchOpportunities().then(setAllStocks).catch(() => {})
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
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen border-r border-border bg-card flex flex-col",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo + Collapse */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="h-7 w-7 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="sidebarLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2DD4BF" />
                  <stop offset="100%" stopColor="#0D9488" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="12" stroke="url(#sidebarLogoGrad)" strokeWidth="2.5" fill="none" />
              <path d="M10 18 L14 12 L18 16 L22 10" stroke="url(#sidebarLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="font-semibold text-lg tracking-tight">
              <span className="text-foreground">VOID</span>
              <span className="text-primary">.AI</span>
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8 shrink-0", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true)
              }}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  navigateToTicker(searchResults[0].ticker)
                }
              }}
              className="h-8 text-sm pl-8 bg-secondary/50 border-none"
            />
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-9 z-50 rounded-md border border-border bg-popover shadow-lg">
                <ul className="max-h-60 overflow-y-auto text-sm">
                  {searchResults.map((stock) => (
                    <li key={stock.ticker}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => navigateToTicker(stock.ticker)}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-secondary text-left"
                      >
                        <div>
                          <div className="font-mono font-semibold text-xs">{stock.ticker}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            {stock.company}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Gap {stock.gapScore}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-3">
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.title}
                </span>
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
              const isAlerts = item.href === "/alerts"

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 group relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {isAlerts && unreadAlerts > 0 && (
                        <Badge className="ml-auto h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground">
                          {unreadAlerts}
                        </Badge>
                      )}
                    </>
                  )}
                  {collapsed && isAlerts && unreadAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2 shrink-0 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )
          ) : (
            <div className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm hover:bg-secondary/80 transition-colors",
                collapsed && "justify-center px-0"
              )}
            >
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user ? `${user.firstName} ${user.lastName}` : "Guest"}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {user?.email || "Not logged in"}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
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
              <Link href="/crypto" className="cursor-pointer">
                <Coins className="mr-2 h-4 w-4" />
                Crypto
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
      </div>
    </aside>
  )
}
