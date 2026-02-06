// Shared OTP storage (in production, use Redis or database)
export const otpStore = new Map<string, { code: string; expiresAt: number }>()

// Shared user storage (in production, use database)
export const userStore = new Map<string, { email: string; firstName: string; lastName: string; password: string }>()
