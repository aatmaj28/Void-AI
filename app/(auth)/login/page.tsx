"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { Sun, Moon, Mail, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function AnimatedBackground() {
    return null
}

function LoginPageContent() {
    const searchParams = useSearchParams()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const error = searchParams.get("error")

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Logo />
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center py-12 px-4 relative overflow-hidden">
                <AnimatedBackground />

                <div className="w-full max-w-md relative z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            Log into your account
                        </h1>
                        <p className="text-muted-foreground">
                            Welcome back to Void AI
                        </p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-8">
                        {error === "Configuration" && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Server configuration error</AlertTitle>
                                <AlertDescription>
                                    Google sign-in is not configured correctly. On Vercel, set{" "}
                                    <strong>AUTH_SECRET</strong> (or NEXTAUTH_SECRET),{" "}
                                    <strong>NEXTAUTH_URL</strong> (e.g. https://void-ai-nine.vercel.app),{" "}
                                    <strong>GOOGLE_CLIENT_ID</strong>, and{" "}
                                    <strong>GOOGLE_CLIENT_SECRET</strong> in Project Settings → Environment Variables, then redeploy.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-4">
                            {/* Email Login Button */}
                            <Button
                                variant="outline"
                                className="w-full h-12 bg-background hover:bg-accent text-foreground border-border hover:border-primary/50 transition-all duration-300"
                                asChild
                            >
                                <Link href="/login/email" className="flex items-center justify-center gap-3">
                                    <Mail className="h-5 w-5" />
                                    <span className="font-medium">Login with Email</span>
                                </Link>
                            </Button>

                            {/* Google Login Button */}
                            <Button
                                variant="outline"
                                className="w-full h-12 bg-background hover:bg-accent text-foreground border-border hover:border-primary/50 transition-all duration-300"
                                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            >
                                <div className="flex items-center justify-center gap-3">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    <span className="font-medium">Login with Google</span>
                                </div>
                            </Button>
                        </div>

                        {/* Sign Up Link */}
                        <div className="mt-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Don't have an account?{" "}
                                <Link
                                    href="/register"
                                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                                >
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Terms */}
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
            </main>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col bg-background">
                <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
                    <div className="container mx-auto flex h-16 items-center justify-between px-4">
                        <Logo />
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse rounded-2xl h-96 w-full max-w-md bg-muted/50" />
                </main>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    )
}
