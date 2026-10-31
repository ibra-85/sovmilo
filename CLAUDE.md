# Sovmilo — Brief projet pour Claude Code

## 1. Contexte

Sovmilo est une application mobile de gestion de budget et d'économies, pensée d'abord pour une utilisatrice peu habituée aux applis complexes (la mère du développeur), puis pour quelques autres utilisateurs.

- Distribution initiale : **APK privé** (pas de store). Publication Google Play / App Store possible plus tard, donc le code doit rester compatible iOS.
- Téléphone cible principal : **Redmi Note 14 Pro+** (HyperOS, Android récent).
- Langues : **français et russe, interface complète** dans chacune. Choix de la langue dans les réglages, détection automatique au premier lancement.
- Priorité absolue : **enregistrer une dépense en quelques secondes**.
- Le développeur ne code pas lui-même : tout est produit par Claude Code. Le code doit donc être lisible, cohérent et accompagné d'explications courtes.

## 2. Stack (validée)

- **Expo** (dernier SDK stable) + **TypeScript strict** + **expo-router**
- **NativeWind** pour le style, **Reanimated** pour les animations (même base que le projet Essavio du développeur)
- **expo-sqlite + Drizzle ORM** : base locale, source de vérité, fonctionne hors ligne
- **Supabase** (région UE) : Auth (lien magique par e-mail), Postgres, Row Level Security. Sert de synchronisation et de sauvegarde
- **i18next + react-i18next + expo-localization** : FR / RU, pluriels russes gérés via les règles de pluriel ICU / i18next
- **Jest** (jest-expo) pour les tests unitaires
- Plus tard : expo-notifications (rappels), ML Kit text recognition via dev build (scan de tickets), expo-local-authentication (PIN / biométrie)

Toujours installer les dépendances avec `npx expo install` pour avoir des versions compatibles avec le SDK. Ne jamais inventer un numéro de version.

## 3. Règles de développement

1. Expliquer brièvement chaque décision technique avant de l'appliquer.
2. Code réel et complet, pas de pseudo-code, pas de bouton qui ne fait rien.
3. Donner les chemins exacts des fichiers créés ou modifiés.
4. Ne jamais affirmer que le projet compile ou que les tests passent sans les avoir lancés.
5. Commandes pour **Windows / PowerShell**.
6. Avancer par petites étapes vérifiables, chacune terminée par : ce qui a été fait, comment le tester, ce qui reste.
7. Ne pas écraser du code existant sans expliquer la modification.
8. Aucun texte affiché en dur : tout passe par les fichiers de traduction `fr` et `ru`.
9. Pas d'API dépréciée.

## 4. Règles métier

- **Montants stockés en centimes, entiers** (`integer` / `bigint`). Jamais de `float` pour l'argent. Affichage via `Intl.NumberFormat` selon la langue (devise EUR).
- Types de transaction : `expense`, `income`, `transfer` (ex. vers l'épargne : ne compte pas comme une dépense).
- Moyens de paiement : `card`, `cash`, `transfer`, `other`.
- Revenus : réguliers (salaire, pension, CAF…), irréguliers, exceptionnels.
- Le **solde réel** (saisi par l'utilisatrice depuis sa banque) est distinct du **solde calculé** à partir des transactions.
- **Reste à dépenser du mois** = revenus du mois − dépenses du mois − transferts vers l'épargne.
- Toute la logique de calcul est dans `src/domain/`, en fonctions pures, **testées**.

## 5. Modèle de données (V1)

Tous les identifiants sont des **UUID générés côté client** (permet la création hors ligne). Chaque table synchronisée a `created_at`, `updated_at`, `deleted_at` (suppression logique).

- `profiles` : id (= auth user id), display_name, locale (`fr` | `ru`), currency (`EUR`), household_id (nullable, réservé au futur budget partagé)
- `categories` : id, user_id, kind (`expense` | `income`), name_key (catégorie par défaut traduite) **ou** custom_name, icon, color, sort_order, archived
- `transactions` : id, user_id, type, amount_cents (> 0), category_id, payment_method, occurred_on (date), note, receipt_id (nullable, futur scan)
- `budgets` : id, user_id, category_id, month (`YYYY-MM`), amount_cents
- `account_snapshots` : id, user_id, real_balance_cents, recorded_at (solde réel saisi)

Côté Supabase : mêmes tables, **RLS activée partout**, politique `user_id = auth.uid()`.

Synchronisation (étape ultérieure) : la base locale reste la source de vérité. On pousse les lignes modifiées depuis la dernière sync, on tire celles modifiées côté serveur, dernier `updated_at` gagnant.

## 6. Sécurité et confidentialité

- Aucun identifiant bancaire, jamais.
- Session Supabase stockée via `expo-secure-store`.
- Clé `anon` Supabase dans `.env` (variables `EXPO_PUBLIC_*`), jamais la clé `service_role` dans l'app.
- Photos de tickets (futur) : supprimées après extraction, sauf option « garder la photo » (stockage local uniquement).

## 7. UX

> **Mise à jour (design handoff, 31 octobre 2026)** : le design « Precision Glass » du dossier `design/` (docs `DESIGN.md`, `COMPONENTS.md`, `MOTION.md`, `INTERACTIONS.md`, `OPEN_DECISIONS.md` + maquettes) est la **source de vérité visuelle**. Il remplace ce qui suit sur les couleurs (graphite / citron au lieu de crème / sauge), la navigation (**Accueil, Opérations, Budgets, Services**, barre flottante + bouton +) et les composants. Les jetons vivent dans `src/theme/`, les composants dans `src/components/ui/` ; les écrans de l'étape 2a seront refaits dans ce design par lots. Les règles de lisibilité ci-dessous (texte ≥ 16 sp pour le corps, zones tactiles ≥ 48–56 dp, confirmation avant suppression) restent valables.

- Navigation par onglets (ancienne version, remplacée par le design) : **Accueil**, **Historique**, **Budget**, **Plus**.
- Accueil : reste à dépenser du mois en très gros, gros bouton **➕ Ajouter**, répartition par catégorie, 5 dernières opérations.
- Ajout d'une dépense : pavé numérique géant, puis grille de grosses icônes de catégories, puis ✓. Date du jour et paiement par carte par défaut, modifiables.
- Texte ≥ 16 sp, zones tactiles ≥ 56 dp, confirmation avant suppression avec possibilité d'annuler.
- Couleurs : fond crème, vert sauge (positif), corail doux (alertes). Thème clair et sombre.
- Police lisible qui gère le cyrillique.
- Écran d'aide HyperOS (plus tard, avec les notifications) : guider l'utilisatrice pour autoriser le démarrage automatique et désactiver l'optimisation batterie.

## 8. Roadmap

- **V1** : saisie dépenses/revenus, catégories, budgets mensuels, historique avec filtres, accueil, FR/RU, comptes Supabase + sync, tests des calculs, APK.
- **V1.1** : dépenses récurrentes et factures, rappels, objectifs d'épargne, PIN / biométrie, graphiques.
- **V1.2** : listes de courses, historique des prix, prix au kg/L.
- **V1.3** : scan de tickets (total, date, magasin, puis lignes), écran de correction, détection des doublons.
- **V2** : budget partagé par foyer, éventuellement banque via agrégateur agréé.

## 9. Étape 1 — à réaliser maintenant

Objectif : une app qui démarre, en FR/RU, où l'on peut **ajouter une dépense hors ligne et la voir sur l'accueil**. Pas encore de Supabase.

1. Créer le projet Expo (TypeScript, expo-router) nommé `sovmilo`, avec l'arborescence :
   ```
   src/
     app/          routes expo-router (onglets)
     components/   composants UI réutilisables
     db/           schéma Drizzle, client SQLite, migrations, seed des catégories
     domain/       calculs purs (money, budget) + tests
     i18n/         config + locales/fr.json, locales/ru.json
     features/     transactions/, categories/ (hooks + écrans)
   ```
2. Configurer NativeWind et le thème (clair/sombre, couleurs ci-dessus).
3. Configurer i18n FR/RU avec détection automatique et un sélecteur de langue dans « Plus ».
4. Créer le schéma Drizzle (`categories`, `transactions`, `budgets`, `profiles` local), les migrations, et un seed de catégories par défaut traduites (courses, logement, énergie, transport, santé, enfants, loisirs, vêtements, téléphone/internet, divers ; revenus : salaire, aides/CAF, pension, autre).
5. Écrire `src/domain/money.ts` (conversion saisie ↔ centimes, formatage) et `src/domain/budget.ts` (totaux du mois, reste à dépenser), avec tests Jest couvrant les cas limites (virgule française, 0, grands montants, transferts exclus des dépenses).
6. Écran **Ajouter** (pavé numérique, choix de la catégorie, validation) et écran **Accueil** (reste à dépenser + dernières opérations), branchés sur SQLite.
7. Lancer les tests et l'app, puis rendre compte : fichiers créés, commandes pour lancer (`npx expo start`, tests), ce qui reste pour l'étape 2 (historique, budgets, Supabase).

Valider l'étape 1 avec le développeur avant de passer à la suite.
