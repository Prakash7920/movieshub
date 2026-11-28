import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WatchHistoryContent } from "@/components/movies/watch-history";
import { LocalizedText } from "@/components/i18n/localized-text";

export default function WatchHistoryPage() {
  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-200"><LocalizedText k="yourLibrary" /></p>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl"><LocalizedText k="watchHistory" /></h1>
          <p className="mt-2 text-sm text-gray-400"><LocalizedText k="watchHistoryPageDescription" /></p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> <LocalizedText k="backToDashboard" />
        </Link>
      </div>
      <WatchHistoryContent />
      <p className="mt-6 text-xs leading-5 text-gray-500"><LocalizedText k="historyPreviewNotice" /></p>
    </div>
  );
}
