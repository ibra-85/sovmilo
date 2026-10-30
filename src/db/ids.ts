import { randomUUID } from 'expo-crypto';

/**
 * Utilisateur « local » tant qu'aucun compte n'est connecté (Supabase arrive à l'étape suivante).
 * À la première connexion, les lignes seront rattachées à l'identifiant du compte.
 */
export const LOCAL_USER_ID = 'local';

/** Nouvel identifiant UUID, généré sur l'appareil : fonctionne hors ligne. */
export const newId = (): string => randomUUID();

/** Horodatage UTC ISO pour `created_at` / `updated_at` / `deleted_at`. */
export const nowISO = (): string => new Date().toISOString();
