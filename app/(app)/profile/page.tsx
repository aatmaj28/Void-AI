"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    User,
    Mail,
    Phone,
    MapPin,
    Building2,
    Briefcase,
    Calendar,
    Save,
    ArrowLeft,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/lib/user-context"


export default function ProfilePage() {
    const router = useRouter()
    const { user, isLoading: userLoading } = useUser()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    // Profile fields
    const [profile, setProfile] = useState({
        phone: "",
        location: "",
        company: "",
        job_title: "",
        bio: "",
        date_of_birth: "",
        linkedin_url: "",
        twitter_url: "",
    })

    // Load existing profile on mount
    useEffect(() => {
        if (user?.email) {
            loadProfile()
        }
    }, [user?.email])

    const loadProfile = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/profile?email=${encodeURIComponent(user!.email)}`)
            if (response.ok) {
                const data = await response.json()
                if (data.profile) {
                    setProfile({
                        phone: data.profile.phone || "",
                        location: data.profile.location || "",
                        company: data.profile.company || "",
                        job_title: data.profile.job_title || "",
                        bio: data.profile.bio || "",
                        date_of_birth: data.profile.date_of_birth || "",
                        linkedin_url: data.profile.linkedin_url || "",
                        twitter_url: data.profile.twitter_url || "",
                    })
                }
            }
        } catch (err) {
            console.error("Error loading profile:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!user?.email) return

        setSaving(true)
        setError("")
        setSuccess(false)

        try {
            const response = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: user.email,
                    ...profile,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to save profile")
            }

            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
            setError(err.message || "Failed to save profile")
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (field: string, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }))
    }

    if (userLoading || loading) {
        return (
            <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p className="text-muted-foreground">Please log in to view your profile.</p>
                <Button className="mt-4" onClick={() => router.push("/login")}>
                    Go to Login
                </Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">Manage your personal information</p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
                {/* User Avatar & Basic Info */}
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-border">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-cyan flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary-foreground">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold">{user.firstName} {user.lastName}</h2>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {user.email}
                        </p>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                    {/* Phone & Location Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                Phone Number
                            </Label>
                            <Input
                                id="phone"
                                placeholder="+1 (555) 123-4567"
                                value={profile.phone}
                                onChange={(e) => handleChange("phone", e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location" className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                Location
                            </Label>
                            <Input
                                id="location"
                                placeholder="Boston, MA"
                                value={profile.location}
                                onChange={(e) => handleChange("location", e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Company & Job Title Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="company" className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                Company
                            </Label>
                            <Input
                                id="company"
                                placeholder="Acme Inc."
                                value={profile.company}
                                onChange={(e) => handleChange("company", e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="job_title" className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                Job Title
                            </Label>
                            <Input
                                id="job_title"
                                placeholder="Software Engineer"
                                value={profile.job_title}
                                onChange={(e) => handleChange("job_title", e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-2">
                        <Label htmlFor="date_of_birth" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            Date of Birth
                        </Label>
                        <Input
                            id="date_of_birth"
                            type="date"
                            value={profile.date_of_birth}
                            onChange={(e) => handleChange("date_of_birth", e.target.value)}
                            className="h-11 w-full md:w-1/2"
                        />
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                        <Label htmlFor="bio" className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Bio
                        </Label>
                        <Textarea
                            id="bio"
                            placeholder="Tell us a bit about yourself..."
                            value={profile.bio}
                            onChange={(e) => handleChange("bio", e.target.value)}
                            rows={4}
                            className="resize-none"
                        />
                    </div>

                    {/* Social Links */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                            <Input
                                id="linkedin_url"
                                placeholder="https://linkedin.com/in/yourname"
                                value={profile.linkedin_url}
                                onChange={(e) => handleChange("linkedin_url", e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="twitter_url">Twitter/X URL</Label>
                            <Input
                                id="twitter_url"
                                placeholder="https://twitter.com/yourhandle"
                                value={profile.twitter_url}
                                onChange={(e) => handleChange("twitter_url", e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="text-sm text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            Profile saved successfully!
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="pt-4 border-t border-border flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="min-w-32 bg-primary hover:bg-primary/90"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Profile
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
