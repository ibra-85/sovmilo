import type { Config } from 'drizzle-kit';

// Utilisé uniquement en développement : `npm run db:generate` produit les migrations SQL dans src/db/migrations.
export default {
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
} satisfies Config;
