import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

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
        const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single()

        if (existingUser) {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 400 }
            )
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Insert user into database
        const { data, error } = await supabase
            .from("users")
            .insert({
                email,
                first_name: firstName,
                last_name: lastName,
                password: hashedPassword
            })
            .select()
            .single()

        if (error) {
            console.error("Supabase error:", error)
            return NextResponse.json(
                { error: "Failed to create account" },
                { status: 500 }
            )
        }

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
