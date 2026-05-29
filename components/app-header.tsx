"use client"

import Link from "next/link"
import { LogOut, Settings, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

export function AppHeader({ showSettings = true }: { showSettings?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">BonusTrak</span>
        </Link>
        <div className="flex items-center gap-1">
          {showSettings && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Open settings"
            >
              <Link href="/settings">
                <Settings className="size-5" />
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
