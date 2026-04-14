import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { supabase } from "@/lib/supabase"

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
    async signIn({ user, account }) {
      // When signing in with Google, ensure the user exists in the Supabase users table
      if (account?.provider === "google" && user.email) {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .single()

        if (!existing) {
          const nameParts = (user.name || "").split(" ")
          const firstName = nameParts[0] || ""
          const lastName = nameParts.slice(1).join(" ") || ""

          await supabase.from("users").insert({
            email: user.email,
            first_name: firstName,
            last_name: lastName,
            password: null,
          })
        }
      }
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
