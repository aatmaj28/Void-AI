import { Logo } from "@/components/logo"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-muted-foreground">—</span>
            <span className="text-muted-foreground text-sm italic">
              We find alpha in the void
            </span>
          </div>

          {/* Separator */}
          <div className="w-full max-w-md h-px bg-border" />

          {/* Developers Section */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Developers
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-sm">
              <a
                href="mailto:salunke.aa@northeastern.edu"
                className="text-foreground hover:text-primary transition-colors"
              >
                Aatmaj Amol Salunke
              </a>
              <a
                href="mailto:mahendrakar.v@northeastern.edu"
                className="text-foreground hover:text-primary transition-colors"
              >
                Vijwal Mahendrakar
              </a>
            </div>
          </div>

          {/* Course Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Built for CS5130 — Applied Programming and Data Processing for AI</p>
            <p>Northeastern University, Boston • Spring 2026</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
