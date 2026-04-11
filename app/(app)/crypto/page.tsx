import Link from "next/link"
import { ArrowLeft, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CryptoComingSoonPage() {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl mx-auto text-center">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card">
            <Coins className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 text-foreground">
          Crypto
        </h1>

        <p className="text-lg sm:text-xl font-semibold text-muted-foreground mb-2">
          Coming Soon
        </p>

        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
          On-chain metrics, token screens, and portfolio hooks are on the roadmap and being styled for Void.AI
        </p>

        <Button variant="outline" asChild>
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to markets
          </Link>
        </Button>
      </div>
    </div>
  )
}
