import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            // You can add custom logic here
            // For example, save user to your database
            return true
        },
        async redirect({ url, baseUrl }) {
            // Redirect to dashboard after successful login
            return `${baseUrl}/dashboard`
        },
        async session({ session, token }) {
            return session
        },
    },
})

export { handler as GET, handler as POST }
