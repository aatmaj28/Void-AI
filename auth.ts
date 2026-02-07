import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Support both GOOGLE_CLIENT_ID/SECRET (v4-style) and AUTH_GOOGLE_ID/SECRET (v5 inferred)
const googleClientId =
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
const hasGoogleOAuth = Boolean(googleClientId && googleClientSecret)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(hasGoogleOAuth
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    // Redirect auth errors to /login so we show a message instead of 500 on /api/auth/error
    error: "/login",
  },
  callbacks: {
    async signIn() {
      return true
    },
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/dashboard`
    },
    async session({ session }) {
      return session
    },
  },
  // Required for Vercel/proxy – Auth.js uses host header; set trustHost so it works behind Vercel
  trustHost: true,
})
