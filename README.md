# MoviesHub

## Overview
MoviesHub is a legal OTT streaming platform for Tamil and dubbed films with a premium dark cinema theme.

## Setup
1. npm install
2. cp .env.example .env.local
3. npm run prisma:generate
4. npm run prisma:migrate
5. npm run prisma:seed
6. npm run dev

## Environment variables
- DATABASE_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- AI_API_KEY

## Database
- npx prisma migrate dev
- npx prisma generate
- npx prisma db seed

## Development
- npm run dev
- npm run build
- npm run lint

## Production notes
- Use signed temporary video URLs
- Do not expose raw private media URLs
- Keep payment keys in environment variables

## Legal notes
All metadata and streams are demo-only placeholders. Production uses only licensed content and approved media partners.
