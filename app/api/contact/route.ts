import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

const TEAM_EMAILS = [
  "salunke.aa@northeastern.edu",
  "mahendrakar.v@northeastern.edu",
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message } = body as { name?: string; email?: string; message?: string }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const subject = `VOID AI — Contact form message from ${name}`
    const text = `Someone sent a message via the VOID AI contact form.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`

    await transporter.sendMail({
      from: `"Void AI" <${process.env.GMAIL_USER}>`,
      to: TEAM_EMAILS.join(", "),
      replyTo: email,
      subject,
      text,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
    })

    return NextResponse.json({ success: true, message: "Message sent successfully" })
  } catch (error) {
    console.error("Error sending contact message:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
