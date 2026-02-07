import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            )
        }

        // Get user from database
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single()

        if (error || !user) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            )
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password)

        if (!passwordMatch) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
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
