import Link from "next/link";
import { Search, Menu, UserRound, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const navItems = [
  { key: "home", href: "/" },
  { key: "movies", href: "/movies" },
  { key: "categories", href: "/categories" },
  { key: "library", href: "/dashboard" },
];

export function Navbar() {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/75 backdrop-blur-xl">
      <div className="page-shell flex h-20 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open menu"
            className="rounded-full border border-white/10 p-2 text-gray-200 md:hidden"
            type="button"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link href="/" className="flex items-center gap-3" aria-label="MoviesHub home">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/90 text-sm font-bold text-white shadow-glow">
              M
            </div>
            <div>
              <div className="text-lg font-semibold tracking-wide text-white">{t.brand}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{t.tagline}</div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-gray-300 transition hover:text-white"
            >
              {t[item.key as keyof typeof t]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              aria-label={t.search}
              className="w-32 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none xl:w-44"
              placeholder={t.searchPlaceholder}
              type="search"
            />
          </div>

          <LanguageSwitcher />

          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            <UserRound className="mr-2 h-4 w-4" />
            {t.login}
          </Button>

          <Button size="sm" className="bg-red-600 text-white hover:bg-red-500">
            <Sparkles className="mr-2 h-4 w-4" />
            {t.subscribe}
          </Button>
        </div>
      </div>
    </header>
  );
}
