# NexaFilm

NexaFilm is a legal OTT platform project for Indian-language cinema. The current application is a **Preview product** with sample catalogue metadata. Do not assume that sample titles are cleared for distribution. Playback and Production release remain disabled until rights, media delivery, operational, and release gates are verified and explicitly approved.

## Current product status

- **Customer experience:** Home, catalogue, search/filter, movie details, credentials authentication, email-verification and password-reset flows, dashboard, watchlist, watch history, account settings, and AI recommendation UI are present. Some areas remain Preview-only and are still undergoing customer-journey validation.
- **Authentication and security:** NextAuth credentials login, password hashing, registration, email verification, verification resend, password reset/change, bounded JWT sessions, session revocation, and rate limiting are implemented in the reviewed application paths. Email delivery requires valid Resend configuration.
- **Admin:** Server-side ADMIN/SUPERADMIN checks and audit logging are implemented for the reviewed movie and licence management routes. This is not a claim that every privileged route or operational workflow has been fully accepted.
- **Payments:** Razorpay order creation, Test Mode checkout/callback verification, and signed webhook processing foundations are present. Preview checkout evidence exists; provider-originated webhook delivery is still unverified. Production payments are not enabled or approved.
- **Media:** Fail-closed playback authorization and a Cloudflare Stream integration foundation have automated tests. Real provider-backed HLS playback, asset rights, and edge expiry/denial have not been validated. Playback/download remain disabled.
- **Operations:** CI, Preview deployment, health checks, migration validation, browser E2E, security and backup runbooks have evidence at specific commits. This does not by itself establish Production readiness.

The canonical milestones, current PASS/PARTIAL/BLOCKED states, blockers, and final acceptance criteria are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

- Next.js App Router (Vercel server runtime)
- React and TypeScript
- Neon PostgreSQL and Prisma ORM
- NextAuth v4 credentials authentication
- bcryptjs password hashing
- Razorpay Test Mode integration foundation
- Cloudflare Stream adapter and signed playback grant foundation (disabled pending provider validation)

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a dedicated development PostgreSQL database and set `DATABASE_URL` and `DIRECT_URL`.
5. Generate a strong `NEXTAUTH_SECRET` (at least 32 characters) and set `NEXTAUTH_URL=http://localhost:3000`.
6. Run `npx prisma migrate deploy` against the local development database.
7. Run `npm run dev`.

For schema changes, use `npm run prisma:migrate`, review the generated migration, add it to the repository, and validate it on an isolated test database before merging.

## Validation scripts

- `npm run typecheck`
- `npm test`
- `npm run test:integration` (requires the isolated local `movieshub_test` database and `MOVIESHUB_E2E=true`)
- `npm run test:e2e` (requires the isolated local `movieshub_test` database and `MOVIESHUB_E2E=true`)
- `npm run test:e2e:playback` (mocked provider/browser contract tests only)
- `npm run build`

Do not point automated tests at Preview or Production databases.

## Deployment and release safety

- Vercel Preview is the environment for product validation. Keep Preview-only test credentials scoped to Preview.
- Production deployment and migrations require a separate reviewed release procedure and explicit owner approval.
- Do not add a payment method, create a paid provider resource, perform a real payment, upload a catalogue asset, enable public playback, change DNS, or mutate Production resources unless that exact action has been separately approved.
- Never commit secrets or paste secret values into issues, pull requests, logs, or chat.
- Keep sample metadata visibly identified as sample content. Publish or stream only titles with documented distribution rights and territory permissions.

## Legal and security notes

Every enabled movie must have evidence for its distribution rights, licensed territories, licence term, languages, and permitted use. Private media must stay behind an authorized backend and short-lived signed access; never expose provider credentials, signing secrets, or raw private media URLs. See [docs/ROADMAP.md](docs/ROADMAP.md) for the release gates.
