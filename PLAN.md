# Pasture implementation plan

1. Replace automatic demo access with real authentication and a clear setup screen.
2. Separate Supabase access, reusable UI, and application pages.
3. Implement persisted herd, milk, health, feed, tasks, reports, and farm settings.
4. Keep administrator account oversight separate from users' private farm records.
5. Add validation, empty/error/loading states, safe deletion, conflict detection, and usable mobile navigation.
6. Supply an additive database migration and a single SQL Editor setup bundle.
7. Check domain calculations, database permissions, and the production build; document anything that cannot be verified without project access.

Deployment is manual through the user's GitHub/Vercel workflow. Do not deploy or change another Supabase project.
