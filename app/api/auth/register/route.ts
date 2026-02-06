import { NextRequest, NextResponse } from "next/server"
import { userStore } from "@/lib/auth-store"

export async function POST(request: NextRequest) {
    try {
        const { email, firstName, lastName, password } = await request.json()

        if (!email || !firstName || !lastName || !password) {
            return NextResponse.json(
                { error: "All fields are required" },
                { status: 400 }
            )
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters" },
                { status: 400 }
            )
        }

        // Check if user already exists
        if (userStore.has(email)) {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 400 }
            )
        }

        // Store user (in production, hash password and use database)
        userStore.set(email, { email, firstName, lastName, password })

        return NextResponse.json({
            success: true,
            message: "Account created successfully"
        })
    } catch (error) {
        console.error("Error creating account:", error)
        return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 }
        )
    }
}
