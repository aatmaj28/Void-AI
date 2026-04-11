"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function AnimatedBackground() {
    return null
}

export default function RegisterVerifyPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [otp, setOtp] = useState(["", "", "", "", "", ""])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        const storedEmail = sessionStorage.getItem("register_email")
        if (!storedEmail) {
            router.push("/register")
            return
        }
        setEmail(storedEmail)
    }, [router])

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        const code = otp.join("")

        if (code.length !== 6) {
            setError("Please enter all 6 digits")
            setLoading(false)
            return
        }

        try {
            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Invalid verification code")
            }

            // Navigate to complete signup
            router.push("/register/complete")
        } catch (err: any) {
            setError(err.message || "Failed to verify code")
            setOtp(["", "", "", "", "", ""])
            inputRefs.current[0]?.focus()
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
                        Verify your email
                    </h1>
                    <p className="text-muted-foreground mt-4">
                        We've emailed a one time security code to{" "}
                        <span className="font-semibold text-foreground">{email}</span>. It should arrive in the
                        next few minutes. If you don't see it in your inbox, please check your spam/junk folder. Please enter
                        it below:
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex gap-2 justify-center">
                            {otp.map((digit, index) => (
                                <Input
                                    key={index}
                                    ref={(el) => {
                                        inputRefs.current[index] = el
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 text-center text-2xl font-bold"
                                />
                            ))}
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
                            {loading ? "Verifying..." : "Confirm email"}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            asChild
                        >
                            <Link href="/register/email">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Go back
                            </Link>
                        </Button>
                    </form>
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
