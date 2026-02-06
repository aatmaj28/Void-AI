import { NextRequest, NextResponse } from "next/server"
import { otpStore } from "@/lib/auth-store"

export async function POST(request: NextRequest) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json(
                { error: "Email and code are required" },
                { status: 400 }
            )
        }

        // Get stored OTP
        const stored = otpStore.get(email)

        if (!stored) {
            return NextResponse.json(
                { error: "No OTP found for this email" },
                { status: 400 }
            )
        }

        // Check if expired
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(email)
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
        otpStore.delete(email)

        return NextResponse.json({ success: true, message: "OTP verified successfully" })
    } catch (error) {
        console.error("Error verifying OTP:", error)
        return NextResponse.json(
            { error: "Failed to verify OTP" },
            { status: 500 }
        )
    }
}
