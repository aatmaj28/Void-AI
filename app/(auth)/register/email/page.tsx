"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function AnimatedBackground() {
    return null
}

export default function RegisterEmailPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const response = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to send OTP")
            }

            // Store email in sessionStorage for next step
            sessionStorage.setItem("register_email", email)

            // Navigate to OTP verification
            router.push("/register/verify")
        } catch (err: any) {
            setError(err.message || "Failed to send verification code")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-background">
            <AnimatedBackground />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">
                        Sign up with your email
                    </h1>
                </div>

                <div className="bg-card border border-border rounded-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12"
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-destructive text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
                            disabled={loading}
                        >
                            {loading ? "Sending code..." : "Next"}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            asChild
                        >
                            <Link href="/register">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Go back
                            </Link>
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="text-primary hover:text-primary/80 font-medium transition-colors"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    By continuing, you agree to Void AI's{" "}
                    <Link href="#" className="underline hover:text-foreground transition-colors">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="underline hover:text-foreground transition-colors">
                        Privacy Policy
                    </Link>
                </p>
            </div>
        </div>
    )
}
