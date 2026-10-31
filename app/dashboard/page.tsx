import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockWatchHistory, mockWatchlist, mockAuthUser } from "@/lib/mock-user";

export default function DashboardPage() {
  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200">My account</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Dashboard</h1>
        </div>
        <Button variant="secondary">Logout</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6 rounded-[1.5rem] border border-white/10 bg-card/70 p-5">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-white/10">
              <Image src={mockAuthUser.avatarUrl} alt={mockAuthUser.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{mockAuthUser.name}</p>
              <p className="text-sm text-gray-400">{mockAuthUser.email}</p>
            </div>
          </div>

          <nav className="space-y-2 text-sm text-gray-300">
            <Link href="/dashboard" className="block rounded-xl bg-red-500/10 px-3 py-2 text-red-200">Profile</Link>
            <Link href="/dashboard/watchlist" className="block rounded-xl px-3 py-2 hover:bg-white/5">Watchlist</Link>
            <Link href="/dashboard/history" className="block rounded-xl px-3 py-2 hover:bg-white/5">Watch History</Link>
            <Link href="/dashboard/settings" className="block rounded-xl px-3 py-2 hover:bg-white/5">Settings</Link>
          </nav>
        </aside>

        <main className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Subscription" value={mockAuthUser.subscriptionStatus} />
            <StatCard label="Watchlist" value={String(mockWatchlist.length)} />
            <StatCard label="History" value={String(mockWatchHistory.length)} />
            <StatCard label="Language" value={mockAuthUser.languagePreference === "ta" ? "தமிழ்" : "English"} />
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Continue Watching</h2>
              <Link href="/dashboard/history" className="text-sm text-red-300">View all</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {mockWatchHistory.slice(0, 3).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="relative mb-3 h-40 overflow-hidden rounded-xl">
                    <Image src={entry.posterUrl} alt={entry.title} fill className="object-cover" />
                  </div>
                  <p className="font-medium text-white">{entry.title}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${entry.progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-gray-400">{entry.progress}% watched</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-6">
              <h2 className="mb-5 text-xl font-semibold text-white">Watchlist</h2>
              <div className="space-y-4">
                {mockWatchlist.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="relative h-20 w-16 overflow-hidden rounded-lg">
                      <Image src={entry.posterUrl} alt={entry.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{entry.title}</p>
                      <p className="text-xs text-gray-400">Added {entry.addedAt}</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Watch
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-6">
              <h2 className="mb-5 text-xl font-semibold text-white">Preferences</h2>
              <div className="space-y-4 text-sm text-gray-300">
                <SettingRow label="Language" value={mockAuthUser.languagePreference === "ta" ? "தமிழ்" : "English"} />
                <SettingRow label="Notifications" value="Enabled" />
                <SettingRow label="Streaming quality" value="Full HD" />
                <SettingRow label="Data Saver" value="Off" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-card/70 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
