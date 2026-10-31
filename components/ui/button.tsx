import Link from "next/link";
import { Instagram, Facebook, Youtube, Twitter } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/10 bg-black/40">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-3">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
              M
            </div>
            <div>
              <div className="font-semibold text-white">{t.brand}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">{t.tagline}</div>
            </div>
          </div>
          <p className="max-w-md text-sm text-gray-400">
            Premium Tamil and dubbed cinema, curated for a legal, high-quality streaming experience.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-300">{t.footerLegal}</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>
              <Link href="/legal/copyright-policy" className="transition hover:text-white">
                {t.copyright}
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="transition hover:text-white">
                {t.privacy}
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="transition hover:text-white">
                {t.terms}
              </Link>
            </li>
            <li>
              <Link href="/legal/content-report" className="transition hover:text-white">
                {t.report}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-300">{t.social}</h3>
          <div className="flex gap-3 text-gray-300">
            {[Instagram, Facebook, Youtube, Twitter].map((Icon, index) => (
              <a
                key={index}
                href="#"
                aria-label="Social link"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition hover:border-red-500 hover:text-red-400"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col items-center justify-between gap-3 py-5 text-sm text-gray-500 md:flex-row">
          <p>© 2026 MoviesHub. All rights reserved.</p>
          <p>Licensed content only. Demo environment.</p>
        </div>
      </div>
    </footer>
  );
}
