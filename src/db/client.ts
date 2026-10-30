import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

/**
 * Base locale = source de vérité de l'application (fonctionne hors ligne).
 * `enableChangeListener` permet aux écrans de se mettre à jour tout seuls quand les données changent (useLiveQuery).
 */
const expoDb = openDatabaseSync('sovmilo.db', { enableChangeListener: true });

// SQLite n'applique pas les clés étrangères par défaut.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
export type AppDb = typeof db;
