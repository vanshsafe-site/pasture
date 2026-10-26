# Pasture

A responsive dairy farm management dashboard built with React, Vite, and Supabase.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Without Supabase environment variables, the app runs in demo mode with sample farm data. To enable accounts and database writes, create a dedicated Supabase project, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` using the project's API URL and publishable key.

Apply both SQL files in `supabase/migrations/` in filename order in the Supabase SQL Editor. Enable email confirmation in Supabase Authentication settings before allowing sign-ups. The app includes email/password sign in and account creation. The confirmed address `vanshgargvl777@gmail.com` receives the administrator role in the database; all other confirmed accounts receive the user role. No role is granted from browser metadata.

The Administrator page lists account email addresses and recent sign-in times. It does not expose passwords, IP addresses, or users' farm records. Users can read only their own profile, while only the admin can read the account directory and sign-in audit. Sign-in events are recorded by a database trigger from Supabase Auth's `last_sign_in_at` value.

## Deploy with GitHub and Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository. Vercel detects Vite; `vercel.json` sets the build command, `npm install` install command, and `dist` output directory. Keep `package-lock.json` in the repository so installs resolve to the pinned dependency tree.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's Environment Variables for Preview and Production.
4. Redeploy after adding environment variables.

You can run `npm test` and `npm run build` locally. The generated site is in `dist/`.

## Current scope

The dashboard includes herd search, schedule task toggles, milk logging, cow creation, and a responsive overview. Milk and cow inserts use Supabase when configured. Summary charts, schedule entries, and health/feed metrics currently use demo values and are ready to be connected to live farm records.
