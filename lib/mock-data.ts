import Link from "next/link";
import { ArrowRight } from "lucide-react";

const categories = [
  { name: "Tamil", slug: "tamil", count: 7 },
  { name: "Dubbed", slug: "dubbed", count: 5 },
  { name: "Action", slug: "action", count: 9 },
  { name: "Comedy", slug: "comedy", count: 4 },
  { name: "Romance", slug: "romance", count: 6 },
  { name: "Thriller", slug: "thriller", count: 5 },
  { name: "Drama", slug: "drama", count: 8 },
  { name: "Family", slug: "family", count: 5 },
  { name: "Horror", slug: "horror", count: 3 },
  { name: "Crime", slug: "crime", count: 4 },
  { name: "Kids", slug: "kids", count: 2 },
  { name: "Documentary", slug: "documentary", count: 2 },
];

export default function CategoriesPage() {
  return (
    <div className="page-shell pb-16 pt-8">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-red-200">Explore</p>
        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">Categories</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.slug} href={`/movies?genre=${encodeURIComponent(category.name)}`} className="group rounded-[1.5rem] border border-white/10 bg-card/70 p-5 transition hover:-translate-y-1 hover:border-red-500/50">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-lg font-bold text-red-200">
              {category.name.charAt(0)}
            </div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{category.name}</h2>
              <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:text-red-300" />
            </div>
            <p className="text-sm text-gray-400">{category.count} titles</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
