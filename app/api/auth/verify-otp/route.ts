import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json(
                { error: "Email and code are required" },
                { status: 400 }
            )
        }

        // Get stored OTP from Supabase
        const { data: stored, error } = await supabase
            .from("otps")
            .select("*")
            .eq("email", email)
            .single()

        if (error || !stored) {
            return NextResponse.json(
                { error: "No OTP found for this email" },
                { status: 400 }
            )
        }

        // Check if expired
        if (new Date() > new Date(stored.expires_at)) {
            // Delete expired OTP
            await supabase.from("otps").delete().eq("email", email)
            return NextResponse.json(
                { error: "OTP has expired" },
                { status: 400 }
            )
        }

        // Verify code
        if (stored.code !== code) {
            return NextResponse.json(
                { error: "Invalid OTP" },
                { status: 400 }
            )
        }

        // OTP is valid, remove it
        await supabase.from("otps").delete().eq("email", email)

        return NextResponse.json({ success: true, message: "OTP verified successfully" })
    } catch (error) {
        console.error("Error verifying OTP:", error)
        return NextResponse.json(
            { error: "Failed to verify OTP" },
            { status: 500 }
        )
    }
}
