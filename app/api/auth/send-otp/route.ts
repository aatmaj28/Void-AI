import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { otpStore } from "@/lib/auth-store"

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    // Store OTP
    otpStore.set(email, { code: otp, expiresAt })

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    // Email template with premium dark theme design
    const mailOptions = {
      from: `"Void AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "🔐 Your Void AI Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
                padding: 40px 20px;
                min-height: 100vh;
              }
              .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: rgba(17, 24, 39, 0.95);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(102, 126, 234, 0.2);
              }
              .header {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
                padding: 40px 30px;
                text-align: center;
                border-bottom: 1px solid rgba(102, 126, 234, 0.2);
                position: relative;
                overflow: hidden;
              }
              .header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%);
                animation: pulse 4s ease-in-out infinite;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.1); opacity: 0.8; }
              }
              .logo {
                font-size: 36px;
                font-weight: 900;
                letter-spacing: 4px;
                background: linear-gradient(135deg, #667eea 0%, #06b6d4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                position: relative;
                z-index: 1;
                text-transform: uppercase;
              }
              .tagline {
                color: rgba(255, 255, 255, 0.6);
                font-size: 14px;
                margin-top: 8px;
                letter-spacing: 2px;
                position: relative;
                z-index: 1;
              }
              .content {
                padding: 50px 40px;
                text-align: center;
              }
              .title {
                color: #ffffff;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 16px;
                background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              }
              .subtitle {
                color: rgba(255, 255, 255, 0.7);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 40px;
              }
              .otp-container {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
                border: 2px solid rgba(102, 126, 234, 0.3);
                border-radius: 16px;
                padding: 30px;
                margin: 30px 0;
                position: relative;
                overflow: hidden;
              }
              .otp-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
                animation: shimmer 3s ease-in-out infinite;
              }
              @keyframes shimmer {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
              }
              .otp-label {
                color: rgba(255, 255, 255, 0.6);
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 16px;
                position: relative;
                z-index: 1;
              }
              .otp-code {
                font-size: 48px;
                font-weight: 900;
                letter-spacing: 16px;
                background: linear-gradient(135deg, #667eea 0%, #06b6d4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-family: 'Courier New', monospace;
                position: relative;
                z-index: 1;
              }
              .expiry-notice {
                display: inline-block;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #fca5a5;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                margin-top: 30px;
                font-weight: 500;
              }
              .security-notice {
                color: rgba(255, 255, 255, 0.5);
                font-size: 14px;
                margin-top: 30px;
                padding: 20px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.05);
              }
              .footer {
                background: rgba(0, 0, 0, 0.3);
                padding: 30px;
                text-align: center;
                border-top: 1px solid rgba(102, 126, 234, 0.2);
              }
              .footer-text {
                color: rgba(255, 255, 255, 0.4);
                font-size: 13px;
                line-height: 1.8;
              }
              .footer-link {
                color: #06b6d4;
                text-decoration: none;
                transition: color 0.3s;
              }
              .footer-link:hover {
                color: #667eea;
              }
              .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.3) 50%, transparent 100%);
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <div class="logo">VOID AI</div>
                <div class="tagline">We find alpha in the void</div>
              </div>
              
              <div class="content">
                <h1 class="title">Verify Your Email Address</h1>
                <p class="subtitle">
                  Enter this verification code to complete your sign up and start your journey with Void AI
                </p>
                
                <div class="otp-container">
                  <div class="otp-label">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                </div>
                
                <div class="expiry-notice">
                  ⏱️ This code will expire in 5 minutes
                </div>
                
                <div class="security-notice">
                  🔒 If you didn't request this code, please ignore this email. Your account security is important to us.
                </div>
              </div>
              
              <div class="footer">
                <div class="divider"></div>
                <p class="footer-text">
                  © 2026 Void AI. All rights reserved.<br>
                  <a href="#" class="footer-link">Privacy Policy</a> • 
                  <a href="#" class="footer-link">Terms of Service</a>
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    }

    // Send email
    await transporter.sendMail(mailOptions)

    return NextResponse.json({ success: true, message: "OTP sent successfully" })
  } catch (error) {
    console.error("Error sending OTP:", error)
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    )
  }
}
