"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import { Film, Home, LayoutDashboard, ShieldCheck, Sparkles, LogOut, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/footer";
import { useLanguage } from "@/components/providers/language-provider";

const navItems = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/movies", labelKey: "movies", icon: Film },
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/assistant", labelKey: "assistant", icon: Sparkles },
  { href: "/admin", labelKey: "admin", icon: ShieldCheck },
] as const;

export function Navbar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getSession().then((session) => {
      const sessionUser = session?.user as unknown as { id?: string } | undefined;
      if (active) setIsLoggedIn(Boolean(sessionUser?.id));
    }).catch(() => {
      if (active) setIsLoggedIn(false);
    });

    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/auth/revoke-session", { method: "POST", cache: "no-store" });
      if (!response.ok && response.status !== 401) {
        throw new Error(t.secureLogoutFailed);
      }

      // Do not let NextAuth resolve "/" against a stale canonical NEXTAUTH_URL.
      // Clear the session without redirecting, then navigate on this exact host.
      await signOut({ redirect: false });
      window.location.assign("/");
    } catch {
      setIsSigningOut(false);
      setLogoutError(t.secureLogoutFailed);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="page-shell flex items-center justify-between gap-4 py-4">
        <Link href="/" aria-label={t.homeLogoAccessibleName} className="flex items-center">
          <Image
            src="/nexafilm-logo.svg"
            alt={t.homeLogoAccessibleName}
            width={210}
            height={53}
            priority
            className="h-auto w-[132px] sm:w-[168px] lg:w-[190px]"
          />
        </Link>

        <nav aria-label={t.primaryNavigation} className="hidden items-center gap-2 md:flex">
          {navItems.map(({ href, labelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {t[labelKey]}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-red-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:hidden"
            aria-label={isMobileMenuOpen ? t.closeNavigationMenu : t.openNavigationMenu}
            aria-controls="mobile-primary-navigation"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <LanguageSwitcher />

          {isLoggedIn ? (
            <button
              type="button"
              aria-label={isSigningOut ? t.loggingOut : t.logout}
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 sm:px-4 py-2 text-sm font-medium text-white transition hover:border-red-500/50 hover:text-red-200 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{isSigningOut ? t.loggingOut : t.logout}</span>
            </button>
          ) : (
            <Link href="/auth/login" className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:border-red-500/50 hover:text-red-200 sm:px-4 sm:text-sm">
              {t.login}
            </Link>
          )}
        </div>
      </div>

      <nav
        id="mobile-primary-navigation"
        aria-label={t.mobilePrimaryNavigation}
        hidden={!isMobileMenuOpen}
        className="page-shell border-t border-white/10 pb-4 pt-3 md:hidden"
      >
        <div className="grid gap-1">
          {navItems.map(({ href, labelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Icon className="h-4 w-4 text-red-200" />
              {t[labelKey]}
            </Link>
          ))}
        </div>
      </nav>

      {logoutError && (
        <div className="page-shell pb-2">
          <p role="alert" className="text-xs text-red-300">{logoutError}</p>
        </div>
      )}
    </header>
  );
}
