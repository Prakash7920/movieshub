import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ContentStatus, LicenseStatus, PrismaClient } from "@prisma/client";
import { GET as listMovies } from "../app/api/movies/route";

const prisma = new PrismaClient();
const suffix = randomUUID();
const allowedGenreSlug = `catalogue-drama-${suffix}`;
const restrictedGenreSlug = `catalogue-restricted-${suffix}`;
const movieSlugs = [
  `catalogue-tamil-${suffix}`,
  `catalogue-english-${suffix}`,
  `catalogue-outside-territory-${suffix}`,
  `catalogue-expired-${suffix}`,
  `catalogue-unpublished-${suffix}`,
];
const genreSlugs = [allowedGenreSlug, restrictedGenreSlug];
let allowedGenreId: string | null = null;
let restrictedGenreId: string | null = null;

function request(query = "", country = "IN") {
  return new Request(`https://catalogue-route-test.example/api/movies${query ? `?${query}` : ""}`, {
    headers: country ? { "x-vercel-ip-country": country } : {},
  });
}

async function createMovie(options: {
  index: number;
  language: string;
  countries: string[];
  genreId: string;
  status?: LicenseStatus;
  expiryDate?: Date;
  isPublished?: boolean;
  contentStatus?: ContentStatus;
  descriptionTa?: string;
}) {
  const movie = await prisma.movie.create({
    data: {
      titleEn: `Catalogue Fixture ${options.index} ${suffix}`,
      titleTa: `திரைப்படச் சோதனை ${options.index} ${suffix}`,
      slug: movieSlugs[options.index]!,
      descriptionEn: `Licensed catalogue search token ${suffix}`,
      descriptionTa: options.descriptionTa ?? `தமிழ் விவரம் ${suffix}`,
      posterUrl: "https://example.invalid/catalogue-poster.jpg",
      backdropUrl: "https://example.invalid/catalogue-backdrop.jpg",
      language: options.language,
      audioLanguages: [options.language],
      subtitleLanguages: ["en"],
      releaseYear: 2026,
      runtimeMinutes: 95,
      ageRating: "U",
      allowedCountries: options.countries,
      isPublished: options.isPublished ?? true,
      contentStatus: options.contentStatus ?? ContentStatus.PUBLISHED,
      genres: {
        create: { genre: { connect: { id: options.genreId } } },
      },
      license: {
        create: {
          owner: `Catalogue Integration Rights ${suffix}`,
          status: options.status ?? LicenseStatus.ACTIVE,
          startDate: new Date(Date.now() - 60_000),
          expiryDate: options.expiryDate ?? new Date(Date.now() + 60 * 60 * 1000),
          allowedCountries: options.countries,
        },
      },
    },
    select: { id: true, slug: true },
  });
  return movie;
}

before(async () => {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Catalogue route integration tests require MOVIESHUB_E2E=true.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const databaseUrl = new URL(raw);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) ||
    !databaseUrl.pathname.includes("movieshub_test")
  ) {
    throw new Error("Catalogue route integration tests may only use the isolated movieshub_test database.");
  }

  await prisma.$connect();
  const allowedGenre = await prisma.genre.create({
    data: { name: `Catalogue Drama ${suffix}`, slug: allowedGenreSlug },
    select: { id: true },
  });
  allowedGenreId = allowedGenre.id;
  const restrictedGenre = await prisma.genre.create({
    data: { name: `Restricted Genre ${suffix}`, slug: restrictedGenreSlug },
    select: { id: true },
  });
  restrictedGenreId = restrictedGenre.id;

  await createMovie({
    index: 0,
    language: "ta",
    countries: ["IN"],
    genreId: allowedGenreId,
    descriptionTa: `மறைவு-தமிழ்-விளக்கம் ${suffix}`,
  });
  await createMovie({
    index: 1,
    language: "en",
    countries: ["IN"],
    genreId: allowedGenreId,
    descriptionTa: `ஆங்கிலப் படம் ${suffix}`,
  });
  await createMovie({
    index: 2,
    language: "ta",
    countries: ["SG"],
    genreId: restrictedGenreId,
  });
  await createMovie({
    index: 3,
    language: "ta",
    countries: ["IN"],
    genreId: restrictedGenreId,
    expiryDate: new Date(Date.now() - 60_000),
  });
  await createMovie({
    index: 4,
    language: "ta",
    countries: ["IN"],
    genreId: restrictedGenreId,
    isPublished: false,
    contentStatus: ContentStatus.UNPUBLISHED,
  });
});

after(async () => {
  await prisma.movie.deleteMany({ where: { slug: { in: movieSlugs } } });
  await prisma.genre.deleteMany({ where: { slug: { in: genreSlugs } } });
  await prisma.$disconnect();
});

test("catalogue API fails closed when the viewer country is unavailable", async () => {
  const response = await listMovies(request("", ""));
  assert.equal(response.status, 503);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  assert.deepEqual(await response.json(), {
    error: "Your viewing country could not be verified. Please try again from the live NexaFilm website.",
  });
});

test("catalogue search includes Tamil descriptions and returns only currently licensed titles in the viewer territory", async () => {
  const response = await listMovies(request(`search=${encodeURIComponent(`மறைவு-தமிழ்-விளக்கம் ${suffix}`)}`));
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  const body = await response.json() as {
    movies: Array<{ slug: string; language: string }>;
    genres: Array<{ slug: string; name: string }>;
  };

  assert.deepEqual(body.movies.map((movie) => movie.slug), [movieSlugs[0]]);
  assert.equal(body.movies[0]?.language, "ta");
  assert.ok(body.genres.some((genre) => genre.slug === allowedGenreSlug));
  assert.ok(!body.genres.some((genre) => genre.slug === restrictedGenreSlug));
});

test("catalogue language, search, and genre filters combine without widening the licensed catalogue", async () => {
  const query = new URLSearchParams({
    search: suffix,
    language: "ta",
    genre: allowedGenreSlug,
  });
  const response = await listMovies(request(query.toString()));
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { movies: Array<{ slug: string; language: string; genres: string[] }> };
  assert.deepEqual(body.movies.map((movie) => movie.slug), [movieSlugs[0]]);
  assert.equal(body.movies[0]?.language, "ta");
  assert.ok(body.movies[0]?.genres.includes(allowedGenreSlug));

  const english = await listMovies(request(new URLSearchParams({ language: "en" }).toString()));
  const englishBody = await english.json() as { movies: Array<{ slug: string }> };
  assert.deepEqual(englishBody.movies.map((movie) => movie.slug), [movieSlugs[1]]);
});

test("catalogue returns a successful empty result for a valid filter with no matching licensed titles", async () => {
  const response = await listMovies(request(new URLSearchParams({ genre: restrictedGenreSlug }).toString()));
  assert.equal(response.status, 200);
  const body = await response.json() as { movies: unknown[]; genres: unknown[] };
  assert.deepEqual(body.movies, []);
  assert.ok(Array.isArray(body.genres));
});

test("catalogue rejects unsupported language codes and malformed genre slugs", async () => {
  const invalidLanguage = await listMovies(request("language=fr"));
  assert.equal(invalidLanguage.status, 400);
  assert.match(invalidLanguage.headers.get("cache-control") ?? "", /private, no-store/);

  const invalidGenre = await listMovies(request("genre=bad%20slug"));
  assert.equal(invalidGenre.status, 400);
});
