"use client"

import Link from "next/link"
import { Target, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function SetupPrompt() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-balance">Set your annual goal to get started</h2>
          <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            Tell BonusTrak your billable-hour target and fiscal year. We&apos;ll track your pace and forecast your
            year-end finish.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/settings">
            Set up goal
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
