"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/components/providers/language-provider";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="page-shell py-12">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 card-glow">
        <Image src="/nexafilm-logo.svg" alt="NexaFilm — One Platform. Every Language. Endless Stories." width={420} height={105} priority className="mb-5 h-auto w-full max-w-[420px]" />
        <h1 className="text-4xl font-bold md:text-6xl">{t.homeHeroTitle}</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-300">
          {t.homeHeroDescription}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/movies" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-medium text-white transition hover:opacity-90">
            {t.exploreCatalogue}
          </Link>
          <Link href="/auth/register" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-transparent px-6 py-3 font-medium text-white transition hover:border-white/20">
            {t.createAccount}
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          {t.homePreviewNotice}
        </p>
      </section>
    </main>
  );
}
