# Sauvegarde et restauration (Lot 7)

Priorité du lot : **ne jamais perdre les données financières**. Ce document dit ce qui est implémenté, ce qui est vérifié automatiquement et ce qui doit être validé sur un téléphone. Rien ici n'a encore été essayé sur Android : voir § 9.

## 1. Inventaire des données (audit)

| Donnée | Où | Dans la sauvegarde |
|---|---|---|
| Opérations, catégories (par défaut et personnalisées, ordre), budgets, soldes déclarés (`account_snapshots`), listes et articles de courses, factures, échéances et paiements, objectifs d'épargne, versements/retraits, archives, ordres personnalisés (`sort_order`), profil local | **SQLite** `sovmilo.db` (11 tables, suppression logique `deleted_at`) | **Oui** (image complète de la base) |
| Historique des migrations (`__drizzle_migrations`) | SQLite | **Oui** (sert à connaître la version du schéma) |
| Préférence de langue (`sovmilo.languagePreference` : `auto` / `fr` / `ru`) | `kv-store` d'expo-sqlite (**autre fichier**, `ExpoSQLiteStorage`) | **Oui**, copiée dans une table de la sauvegarde |
| Préférence d'apparence (`sovmilo.theme` : système / clair / sombre) | `kv-store` | **Oui**, idem |
| Ancienne clé `sovmilo.locale` | `kv-store` | Non (obsolète, migrée au démarrage) |
| Date de dernière sauvegarde / exportation | `kv-store` (`sovmilo.backup.last`) | **Non** : elle décrit CET appareil |
| Fichiers locaux (photos de tickets, pièces jointes) | n'existent pas encore | — |
| Session, clés, identifiants bancaires | n'existent pas (aucun compte, aucun serveur) | — |
| Caches de requêtes, état des écrans, mois consulté, filtres | mémoire | Non (temporaire) |

Conclusion : **une copie du fichier SQLite seule ne suffirait pas** (elle perdrait langue et apparence). Les préférences sont donc rangées dans le même fichier, dans une table dédiée de la COPIE (jamais dans la base courante).

## 2. État réel du stockage

- Fichier : `sovmilo.db`, dossier SQLite par défaut d'expo-sqlite (stockage privé de l'application).
- Une seule connexion d'application, ouverte à l'import de `src/db/client.ts` (`openDatabaseSync`, `enableChangeListener: true`, `PRAGMA foreign_keys = ON`). Mode de journal : celui par défaut (aucun `PRAGMA journal_mode` n'est posé).
- Migrations : `useMigrations` (Drizzle) au démarrage ; l'état est dans `__drizzle_migrations` (`created_at` = date du journal, `hash` vide avec le migrateur Expo).
- Les dépôts importent la constante `db` : **on ne peut pas remplacer le fichier ni rouvrir une autre connexion** sans la réécrire. C'est ce qui impose le mode de restauration choisi (§ 5).

## 3. Format

Un fichier **SQLite** valide, `sovmilo-backup-AAAA-MM-JJ-HHMM.db`. Il s'ouvre avec n'importe quel outil SQLite, sans logiciel spécial. Il n'est PAS compressé (la base pèse quelques centaines de Ko à quelques Mo : une dépendance de compression n'apporte rien).

Identification (le nom ne compte pas) :

1. **En-tête SQLite** : `application_id` = `0x534F564D` (« SOVM »), lisible sans ouvrir la base (octets 68–71). Un fichier SQLite étranger est refusé avant même d'être ouvert.
2. Table `sovmilo_backup_meta` (clé / valeur) : `app_id` (`app.sovmilo`), `format_version` (1), `app_version`, `schema_version` (nombre de migrations appliquées), `schema_last_migration` (date de la dernière), `created_at` (UTC), `counts` (JSON : compteurs).
3. Table `sovmilo_backup_prefs` (clé / valeur) : langue et apparence.

La sauvegarde est donc non chiffrée et lisible par quiconque obtient le fichier (§ 7).

## 4. Création (capture cohérente)

1. `serializeAsync()` sur la connexion de l'application : image cohérente de la base (les écritures validées, journal compris). Aucune copie brute du fichier.
2. L'image est ouverte **en mémoire** (`deserializeDatabaseAsync`) : la base courante n'est jamais modifiée et aucun fichier temporaire n'est créé.
3. Vérification de l'image : `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, tables et colonnes attendues. Si la base courante est elle-même incohérente, la sauvegarde est refusée (on ne propage pas un défaut).
4. Ajout de l'identité (§ 3) et des préférences, dans la copie mémoire.
5. Sérialisation du résultat, puis **relecture** : le fichier produit est rouvert et revérifié (identité, intégrité, compteurs identiques).
6. Écriture dans le dossier choisi par l'utilisatrice (sélecteur Android, donc hors du stockage privé : Téléchargements, Drive, carte…), puis **relecture du fichier écrit** et comparaison octet par octet. Seulement alors : « Sauvegarde enregistrée ».

Deux états distincts dans l'interface : « sauvegarde créée et vérifiée » (étapes 1–5) et « fichier enregistré dans le dossier choisi et relu » (étape 6). Annuler le sélecteur de dossier n'écrit rien et n'est pas une erreur. Une sauvegarde précédente n'est jamais supprimée ni écrasée : un nouveau nom est utilisé, et si le nom existe déjà Android ajoute un suffixe.

## 5. Restauration (remplacement contrôlé)

Restauration **complète** (la base courante est remplacée). Aucune fusion : elle créerait des doublons d'opérations, d'échéances et de paiements.

**Pourquoi pas « remplacer le fichier »** : la connexion de l'application est unique, ouverte à l'import, et des abonnements l'utilisent ; fermer la base ou écraser son fichier sous elle est exactement ce que le cahier des charges interdit. On utilise donc l'**API de sauvegarde de SQLite** (`backupDatabaseAsync`) : elle copie une base source DANS la connexion de destination, en une seule transaction atomique. Si elle échoue, SQLite annule : la base courante reste intacte.

Étapes :

1. **Prévalidation, sans toucher à la base courante** : fichier lisible ; taille raisonnable (≤ 100 Mo) ; en-tête SQLite et `application_id` Sovmilo ; ouverture **en mémoire, isolée**, avec `trusted_schema = OFF` et `query_only = ON` ; objets autorisés seulement (aucun déclencheur ni vue) ; métadonnées (`app_id`, `format_version`) ; version du schéma (§ 6) ; `integrity_check` et `foreign_key_check` ; si le schéma est ancien, migration **dans la copie** puis nouvelle vérification ; tables et colonnes exactement celles de l'application. Aucun SQL du fichier n'est exécuté : seules nos requêtes fixes lisent le contenu.
2. **Aperçu** : les compteurs affichés sont lus dans la copie validée (opérations, budgets, listes, factures, objectifs…), pas dans les métadonnées.
3. **Confirmation** explicite (« remplacera les données actuellement enregistrées »), bouton d'action distinct, jamais un simple Toast.
4. **Copie de sécurité** de la base courante : image `serializeAsync`, vérifiée (ouverture + intégrité + mêmes compteurs), puis écrite dans le stockage privé de l'application (`sovmilo-avant-restauration.db`). Elle n'est supprimée qu'après validation de la nouvelle base, et la plus récente est conservée.
5. **Pause des écritures** : écran de progression plein écran non fermable (retour Android bloqué), l'état « maintenance » interdit une seconde restauration et le redémarrage de mise à jour.
6. **Bascule** : `backupDatabaseAsync` de la copie validée vers la connexion de l'application.
7. **Validation** : intégrité, clés étrangères, schéma, compteurs identiques à l'aperçu, migrations à jour. Seulement alors : application des préférences (langue, apparence), relecture de toutes les requêtes (`refreshLiveData` : plus aucune donnée de l'ancienne base ne reste affichée), puis « Restauration réussie ».
8. **Échec à l'étape 6 ou 7** : retour automatique à la copie de sécurité (même mécanisme), nouvelle vérification, message qui dit ce qui s'est passé. Si même ce retour échoue, le message le dit et la copie de sécurité reste sur l'appareil (procédure de dernier recours dans le bilan du lot).

## 6. Compatibilité des versions

`schema_version` = nombre de migrations appliquées dans la sauvegarde ; l'application en connaît `N` (le journal Drizzle). Chaque migration enregistrée doit correspondre à celle du journal (même date), sinon le fichier est refusé.

| Sauvegarde | Décision |
|---|---|
| `schema_version = N` | restauration normale |
| `1 ≤ schema_version < N` | **migration en avant, dans la copie isolée**, avant la bascule ; vérification après migration |
| `schema_version > N` (application plus ancienne que la sauvegarde) | **refus** : « sauvegarde créée par une version plus récente » ; jamais de migration à l'envers |
| `format_version` inconnue, `app_id` étranger, migrations non reconnues | refus |

Évolutions : une future migration ne rend pas les anciennes sauvegardes inutilisables (elles sont migrées en avant). Les tests restaurent des sauvegardes aux schémas 1 à N.

Mises à jour OTA et schéma : un rollback EAS Update **n'annule pas** une migration SQLite. Règles : migrations additives (nouvelles colonnes/tables, jamais de suppression dans la même version), démarrage qui vérifie l'état, et sauvegarde recommandée avant une version qui migre (voir `docs/eas-updates.md`).

## 7. Sécurité et confidentialité

- Rien n'est envoyé nulle part : ni Expo, ni GitHub, ni un nuage. Le fichier va là où l'utilisatrice le met.
- **Le fichier n'est pas chiffré.** Quiconque le possède peut lire toutes les données. L'interface le dit avant l'enregistrement.
- Chiffrement : non retenu pour cette première version. Une bibliothèque sérieuse (par exemple SQLCipher) exige une modification native de SQLite d'Expo, donc une configuration et une build natives spécifiques, et un mot de passe oublié rendrait la sauvegarde irrécupérable. Mieux vaut une sauvegarde restaurable et clairement signalée non chiffrée. À étudier plus tard, avec une récupération expliquée.
- Les messages d'erreur ne contiennent jamais de montants, de noms ni de chemins personnels (codes d'erreur traduits). Aucun journal ne reçoit de données.
- Aucune copie temporaire sur disque : la capture et la vérification se font en mémoire. Seule la copie de sécurité (stockage privé) existe sur le disque ; elle n'est pas dans le dépôt Git, qui ignore `*.db`.

## 8. Parcours Expo Go → application autonome

Les données d'Expo Go et celles de l'application autonome sont **séparées** (autre identité Android, autre stockage). Elles ne se transfèrent que par une sauvegarde :

1. Dans Expo Go (installation actuelle) : Paramètres → Données et sauvegardes → « Sauvegarder mes données » → choisir un dossier **hors de l'application** (Téléchargements ou Drive).
2. Vérifier que le fichier existe (gestionnaire de fichiers).
3. Installer l'APK autonome **sans désinstaller Expo Go**.
4. Ouvrir la nouvelle application → Paramètres → « Restaurer une sauvegarde » → choisir le fichier → vérifier l'aperçu → confirmer.
5. Comparer (protocole § 10 de `docs/android-distribution.md`), puis seulement après, envisager de retirer Expo Go.

Compatibilité Expo Go : `expo-sqlite` et `expo-file-system` (sélecteur de fichiers et de dossier) sont inclus dans Expo Go ; aucune dépendance native supplémentaire n'a été ajoutée pour la sauvegarde. Ce point n'a pas été essayé ici (aucun appareil) : voir § 9, parcours 1.

## 9. Ce qui est validé, ce qui ne l'est pas

Légende : ✅ implémenté · 🧪 validé automatiquement · 📱 à valider sur un téléphone · 🔗 dépend d'une build autonome.

**Implémenté et validé automatiquement** (base SQLite réelle de Node, vraies migrations, `src/features/backup/*.test.ts`) : création et vérification de la sauvegarde ; ouverture isolée ; refus des fichiers invalides (vides, tronqués, corrompus, SQLite étrangers, identité ou version inconnues, schéma futur, objets inattendus, clés étrangères invalides) ; aller-retour complet avec comparaison des données (opérations, catégories personnalisées, budgets, soldes déclarés, listes et articles cochés, factures mensuelles/annuelles avec échéances payées ou non, objectifs d'épargne avec versements, objectifs archivés, ordre personnalisé, accents, cyrillique, grands montants) ; migration d'anciens schémas 1 à 4 ; retour arrière automatique depuis la copie de sécurité (échec injecté avant, pendant la copie, pendant une migration) ; base source jamais modifiée ; verrou de maintenance ; parcours de l'interface (machine d'états avec couche plateforme simulée : annulation, refus, retour arrière, double appui, fichier refermé) ; messages FR/RU pour chaque code d'erreur.

**Implémenté mais non exécuté hors de Node** (📱) : la couche `src/features/backup/platform.ts` et l'interface de Paramètres. Compilent (`tsc`, ESLint) mais n'ont jamais tourné sur Android :

- le comportement réel de `serializeAsync`, `deserializeDatabaseAsync` et `backupDatabaseAsync` (copie *dans* la connexion ouverte) sur Android ; l'essai Node utilise une copie émulée par `ATTACH` ;
- le sélecteur de dossier (`Directory.pickDirectoryAsync`) et de fichier (`File.pickFileAsync`) : sémantique de l'annulation non documentée (l'annulation est reconnue par le texte de l'erreur : `annul|cancel|dismiss`, à confirmer), conservation de l'extension `.db` ;
- l'écriture puis la relecture d'un fichier dans « Téléchargements » ou un dossier Drive ;
- la mémoire sur un très gros fichier (limite posée à 100 Mo) ;
- l'absence d'écriture en arrière-plan pendant une restauration : garantie par l'interface bloquante et le verrou de maintenance, pas par le pilote SQLite ;
- le rafraîchissement de tous les écrans après une restauration (testé avec les hooks de données et une base Node, pas avec le natif).

**Expo Go → application autonome** (📱 🔗) : jamais essayé (§ 8). Protocole : `docs/android-distribution.md` § 10 et liste de contrôle § 11.

**Limites assumées** : sauvegarde **non chiffrée** (dite clairement à l'utilisatrice avant l'enregistrement) ; pas de chiffrement maison ; pas de sauvegarde automatique ; pas de sauvegarde automatique avant une migration ; les préférences prises en compte sont la langue et le thème (les autres réglages locaux ne sont ni sauvegardés ni supprimés).
