import { AppHeader } from "@/components/app-header"
import { DashboardView } from "@/components/dashboard/dashboard-view"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 md:pb-10">
        <DashboardView />
      </main>
    </div>
  )
}
