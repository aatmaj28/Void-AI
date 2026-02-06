import { NextRequest, NextResponse } from "next/server"
import { userStore } from "@/lib/auth-store"

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            )
        }

        // Get user from store
        const user = userStore.get(email)

        if (!user) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            )
        }

        // Verify password (in production, use bcrypt)
        if (user.password !== password) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            )
        }

        // In production, create session/JWT token here
        return NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        })
    } catch (error) {
        console.error("Error logging in:", error)
        return NextResponse.json(
            { error: "Failed to login" },
            { status: 500 }
        )
    }
}
