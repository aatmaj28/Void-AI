import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { supabase } from "@/lib/supabase"

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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

    // Delete any existing OTP for this email
    await supabase.from("otps").delete().eq("email", email)

    // Store OTP in Supabase
    const { error: insertError } = await supabase.from("otps").insert({
      email,
      code: otp,
      expires_at: expiresAt
    })

    if (insertError) {
      console.error("Failed to store OTP:", insertError)
      return NextResponse.json(
        { error: "Failed to send OTP" },
        { status: 500 }
      )
    }

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    // Email template with premium light theme design
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
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%);
                padding: 40px 20px;
                min-height: 100vh;
              }
              .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(102, 126, 234, 0.15);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #06b6d4 100%);
                padding: 40px 30px;
                text-align: center;
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
                background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
              }
              .logo-container {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                position: relative;
                z-index: 1;
              }
              .logo-icon {
                width: 48px;
                height: 48px;
              }
              .logo-text {
                font-size: 32px;
                font-weight: 900;
                letter-spacing: 3px;
                color: #ffffff;
                text-transform: uppercase;
              }
              .logo-ai {
                color: rgba(255, 255, 255, 0.85);
                font-weight: 300;
              }
              .tagline {
                color: rgba(255, 255, 255, 0.9);
                font-size: 14px;
                margin-top: 12px;
                letter-spacing: 1px;
                position: relative;
                z-index: 1;
              }
              .content {
                padding: 50px 40px;
                text-align: center;
                background: #ffffff;
              }
              .title {
                color: #1e293b;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 16px;
              }
              .subtitle {
                color: #64748b;
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 40px;
              }
              .otp-container {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 2px solid #e2e8f0;
                border-radius: 16px;
                padding: 30px;
                margin: 30px 0;
                position: relative;
              }
              .otp-label {
                color: #64748b;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 16px;
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
              }
              .expiry-notice {
                display: inline-block;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border: 1px solid #f59e0b;
                color: #92400e;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                margin-top: 30px;
                font-weight: 500;
              }
              .security-notice {
                color: #64748b;
                font-size: 14px;
                margin-top: 30px;
                padding: 20px;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
              }
              .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%);
                margin: 20px 0;
              }
              .developer-section {
                background: #f8fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
              }
              .developer-label {
                color: #94a3b8;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 12px;
              }
              .developer-names {
                color: #475569;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 16px;
              }
              .developer-names a {
                color: #667eea;
                text-decoration: none;
              }
              .course-info {
                color: #94a3b8;
                font-size: 12px;
                line-height: 1.6;
              }
              .course-info a {
                color: #667eea;
                text-decoration: none;
              }
              .footer {
                background: #ffffff;
                padding: 25px 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
              }
              .footer-text {
                color: #94a3b8;
                font-size: 12px;
                line-height: 1.8;
              }
              .footer-link {
                color: #667eea;
                text-decoration: none;
              }
              .decorative-dots {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin: 20px 0;
              }
              .dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #06b6d4 100%);
                opacity: 0.3;
              }
              .dot:nth-child(2) {
                opacity: 0.6;
              }
              .dot:nth-child(3) {
                opacity: 1;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <div class="logo-container">
                  <svg class="logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" stroke="white" stroke-width="2" fill="none"/>
                    <path d="M12 20C12 15.5 15.5 12 20 12C24.5 12 28 15.5 28 20" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="20" cy="20" r="4" fill="white"/>
                  </svg>
                  <span class="logo-text">VOID<span class="logo-ai">.AI</span></span>
                </div>
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
              
              <div class="developer-section">
                <div class="decorative-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
                <div class="developer-label">Developers</div>
                <div class="developer-names">
                  <a href="#">Aatmaj Amol Salunke</a> &nbsp;•&nbsp; <a href="#">Vijwal Mahendrakar</a>
                </div>
                <div class="course-info">
                  Built for <a href="#">CS5130</a> — Applied Programming and Data Processing for AI<br>
                  Northeastern University, Boston • Spring 2026
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
