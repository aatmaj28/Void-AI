"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useSession } from "next-auth/react"

interface User {
    email: string
    firstName: string
    lastName: string
}

interface UserContextType {
    user: User | null
    setUser: (user: User | null) => void
    logout: () => void
    isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const { data: session, status } = useSession()

    useEffect(() => {
        if (status === "loading") return

        // If NextAuth has a session (e.g. Google OAuth), use it
        if (status === "authenticated" && session?.user) {
            const email = session.user.email ?? ""
            const name = session.user.name ?? ""
            const [firstName, ...rest] = name.split(" ")
            const oauthUser = { email, firstName, lastName: rest.join(" ") }
            setUserState(oauthUser)
            localStorage.setItem("void_user", JSON.stringify(oauthUser))
            setIsLoading(false)
            return
        }

        // Otherwise fall back to localStorage (email/password users)
        const storedUser = localStorage.getItem("void_user")
        if (storedUser) {
            try {
                setUserState(JSON.parse(storedUser))
            } catch (e) {
                localStorage.removeItem("void_user")
            }
        }
        setIsLoading(false)
    }, [status, session])

    const setUser = (newUser: User | null) => {
        setUserState(newUser)
        if (newUser) {
            localStorage.setItem("void_user", JSON.stringify(newUser))
        } else {
            localStorage.removeItem("void_user")
        }
    }

    const logout = () => {
        setUser(null)
    }

    return (
        <UserContext.Provider value={{ user, setUser, logout, isLoading }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider")
    }
    return context
}
