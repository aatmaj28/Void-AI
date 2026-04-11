"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Bell,
  BellOff,
  Check,
  Trash2,
  Filter,
  TrendingUp,
  Activity,
  Eye,
  BarChart3,
  AlertCircle,
  Settings,
  Mail,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getRelativeTime } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { useToast } from "@/hooks/use-toast"
import { 
  fetchUserAlerts, 
  fetchUserAlertSettings, 
  updateAlertSettings, 
  markAlertAsRead, 
  markAllAlertsAsRead, 
  removeAlert, 
  clearReadAlerts, 
  Alert as SupabaseAlert,
  AlertSettings
} from "@/lib/alerts-api"

const alertTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  gap_increase: { icon: TrendingUp, color: "text-primary", label: "Gap Increase" },
  volume_spike: { icon: Activity, color: "text-cyan", label: "Volume Spike" },
  new_opportunity: { icon: Eye, color: "text-success", label: "New Opportunity" },
  coverage_change: { icon: BarChart3, color: "text-warning", label: "Coverage Change" },
  price_movement: { icon: TrendingUp, color: "text-foreground", label: "Price Movement" },
}

const severityColors: Record<string, string> = {
  high: "border-destructive/50 bg-destructive/10 text-destructive",
  medium: "border-warning/50 bg-warning/10 text-warning",
  low: "border-muted-foreground/50 bg-muted text-muted-foreground",
}

export default function AlertsPage() {
  const { user } = useUser()
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<SupabaseAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [filterType, setFilterType] = useState<string>("all")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterRead, setFilterRead] = useState<string>("all")
  const [showSettings, setShowSettings] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Alert settings
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    user_email: user?.email || "",
    gap_increase: true,
    volume_spike: true,
    new_opportunity: true,
    coverage_change: true,
    price_movement: false,
    email_notifications: true,
    gap_threshold: 5,
    volume_threshold: 2,
  })

  useEffect(() => {
    if (!user?.email) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [alertsData, settingsData] = await Promise.all([
          fetchUserAlerts(user.email),
          fetchUserAlertSettings(user.email)
        ])
        
        setAlerts(alertsData)
        if (settingsData) {
          setAlertSettings(settingsData)
        } else {
          // If no settings exist yet, set it up with current user email
          setAlertSettings(prev => ({ ...prev, user_email: user.email! }))
        }
      } catch (error) {
        console.error("Failed to load alerts data", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user?.email])

  const handleSaveSettings = async () => {
    if (!user?.email) return
    setIsSavingSettings(true)
    try {
      await updateAlertSettings({
        ...alertSettings,
        user_email: user.email
      })
      toast({
        title: "Settings Saved",
        description: "Your alert settings have been saved successfully.",
        className: "border-primary/50 bg-card",
      })
    } catch (error) {
      console.error("Failed to save settings", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSettingChange = (key: keyof AlertSettings, value: any) => {
    setAlertSettings(prev => ({ ...prev, [key]: value }))
  }

  const filteredAlerts = alerts.filter((alert) => {
    const matchesType = filterType === "all" || alert.type === filterType
    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity
    const matchesRead =
      filterRead === "all" ||
      (filterRead === "unread" && !alert.read) ||
      (filterRead === "read" && alert.read)
    return matchesType && matchesSeverity && matchesRead
  })

  const unreadCount = alerts.filter((a) => !a.read).length

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, read: true } : a)))
    try {
      await markAlertAsRead(id)
    } catch (error) {
      // Revert on failure
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, read: false } : a)))
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user?.email) return
    const prevAlerts = [...alerts]
    // Optimistic update
    setAlerts(alerts.map((a) => ({ ...a, read: true })))
    try {
      await markAllAlertsAsRead(user.email)
    } catch (error) {
      setAlerts(prevAlerts)
    }
  }

  const handleDeleteAlert = async (id: string) => {
    const prevAlerts = [...alerts]
    setAlerts(alerts.filter((a) => a.id !== id))
    try {
      await removeAlert(id)
    } catch (error) {
      setAlerts(prevAlerts)
    }
  }

  const handleClearAllRead = async () => {
    if (!user?.email) return
    const prevAlerts = [...alerts]
    setAlerts(alerts.filter((a) => !a.read))
    try {
      await clearReadAlerts(user.email)
    } catch (error) {
      setAlerts(prevAlerts)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading 
              ? "Loading..." 
              : unreadCount > 0
              ? `You have ${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleMarkAllAsRead} disabled={unreadCount === 0 || isLoading}>
            <Check className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button
            variant={showSettings ? "secondary" : "outline"}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Alert Settings */}
      {showSettings && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Alert Settings</span>
              <Button 
                onClick={handleSaveSettings} 
                disabled={isSavingSettings}
                size="sm"
              >
                {isSavingSettings ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Alert Types</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm">Gap Score Increase</span>
                  </div>
                  <Switch
                    checked={alertSettings.gap_increase}
                    onCheckedChange={(c) => handleSettingChange("gap_increase", c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan" />
                    <span className="text-sm">Volume Spike</span>
                  </div>
                  <Switch
                    checked={alertSettings.volume_spike}
                    onCheckedChange={(c) => handleSettingChange("volume_spike", c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-success" />
                    <span className="text-sm">New Opportunity</span>
                  </div>
                  <Switch
                    checked={alertSettings.new_opportunity}
                    onCheckedChange={(c) => handleSettingChange("new_opportunity", c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-warning" />
                    <span className="text-sm">Coverage Change</span>
                  </div>
                  <Switch
                    checked={alertSettings.coverage_change}
                    onCheckedChange={(c) => handleSettingChange("coverage_change", c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Price Movement</span>
                  </div>
                  <Switch
                    checked={alertSettings.price_movement}
                    onCheckedChange={(c) => handleSettingChange("price_movement", c)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3">Thresholds</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Gap Score Change (points)
                  </label>
                  <Input
                    type="number"
                    value={alertSettings.gap_threshold}
                    onChange={(e) => handleSettingChange("gap_threshold", parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Volume Multiplier (x average)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={alertSettings.volume_threshold}
                    onChange={(e) => handleSettingChange("volume_threshold", parseFloat(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3">Notifications</h4>
              <div className="flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Email Notifications</span>
                </div>
                <Switch
                  checked={alertSettings.email_notifications}
                  onCheckedChange={(c) => handleSettingChange("email_notifications", c)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Alert Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="gap_increase">Gap Increase</SelectItem>
                    <SelectItem value="volume_spike">Volume Spike</SelectItem>
                    <SelectItem value="new_opportunity">New Opportunity</SelectItem>
                    <SelectItem value="coverage_change">Coverage Change</SelectItem>
                    <SelectItem value="price_movement">Price Movement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Severity</label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterRead} onValueChange={setFilterRead}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {alerts.some((a) => a.read) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive bg-transparent"
                  onClick={handleClearAllRead}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Read Alerts
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <div className="w-10 text-right">
                  <span className="font-mono font-medium">{alerts.length}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Unread</span>
                <div className="w-10 text-right">
                  <span className={`font-mono font-medium ${unreadCount > 0 ? 'text-primary' : 'text-foreground'}`}>
                    {unreadCount}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">High Priority</span>
                <div className="w-10 text-right">
                  <span className="font-mono font-medium text-destructive">
                    {alerts.filter((a) => a.severity === "high" && !a.read).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading your alerts...</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="py-12 text-center">
                  <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No alerts match your filters or database is empty</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredAlerts.map((alert) => {
                    const typeConfig = alertTypeConfig[alert.type] || {
                      icon: AlertCircle,
                      color: "text-foreground",
                      label: alert.type,
                    }
                    const Icon = typeConfig.icon

                    return (
                      <div
                        key={alert.id}
                        className={`p-4 transition-colors hover:bg-secondary/30 ${
                          !alert.read ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div
                            className={`flex-shrink-0 h-10 w-10 rounded-full bg-secondary flex items-center justify-center ${typeConfig.color}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/stock/${alert.ticker}`}
                                className="font-mono font-semibold hover:text-primary transition-colors"
                              >
                                {alert.ticker}
                              </Link>
                              <Badge variant="outline" className="text-xs">
                                {typeConfig.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${severityColors[alert.severity] || severityColors.low}`}
                              >
                                {alert.severity}
                              </Badge>
                              {!alert.read && (
                                <span className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {alert.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getRelativeTime(alert.created_at)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!alert.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMarkAsRead(alert.id)}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteAlert(alert.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
