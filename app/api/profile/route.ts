import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET - Load profile by email
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const email = searchParams.get("email")

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            )
        }

        // First get user_id from users table
        const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single()

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        // Then get profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single()

        return NextResponse.json({ profile: profile || null })
    } catch (error) {
        console.error("Error loading profile:", error)
        return NextResponse.json(
            { error: "Failed to load profile" },
            { status: 500 }
        )
    }
}

// POST - Save/update profile
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            email,
            phone,
            location,
            company,
            job_title,
            bio,
            date_of_birth,
            linkedin_url,
            twitter_url
        } = body

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            )
        }

        // Get user_id from users table
        const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single()

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        // Check if profile exists
        const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .single()

        const profileData = {
            user_id: user.id,
            phone: phone || null,
            location: location || null,
            company: company || null,
            job_title: job_title || null,
            bio: bio || null,
            date_of_birth: date_of_birth || null,
            linkedin_url: linkedin_url || null,
            twitter_url: twitter_url || null,
            updated_at: new Date().toISOString(),
        }

        let result
        if (existingProfile) {
            // Update existing profile
            result = await supabase
                .from("profiles")
                .update(profileData)
                .eq("user_id", user.id)
                .select()
                .single()
        } else {
            // Insert new profile
            result = await supabase
                .from("profiles")
                .insert(profileData)
                .select()
                .single()
        }

        if (result.error) {
            console.error("Supabase error:", result.error)
            return NextResponse.json(
                { error: "Failed to save profile" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Profile saved successfully",
            profile: result.data
        })
    } catch (error) {
        console.error("Error saving profile:", error)
        return NextResponse.json(
            { error: "Failed to save profile" },
            { status: 500 }
        )
    }
}
