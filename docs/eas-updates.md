# Mises à jour EAS Update (Lot 7)

Une mise à jour « OTA » remplace le **JavaScript** d'une application déjà installée, sans nouvel APK. Elle ne change ni le code natif, ni la signature, ni le nom de paquet. Ce document décrit ce qui est configuré, le protocole de publication et le retour arrière. La légende (✅ 🧪 👤 📱 🔗 ☁️) est celle de `docs/android-distribution.md`.

## 1. État

| Élément | État |
| --- | --- |
| `expo-updates` installé (`~58.0.20`, via `npx expo install`) | ✅ |
| `runtimeVersion` = politique `fingerprint` | ✅ 🧪 (configuration + empreintes locales) |
| `updates.url` calculée depuis `extra.eas.projectId` | ✅ 🧪 ; **projectId absent** : 👤 ☁️ `eas init` |
| Canaux `preview` / `production` écrits dans `eas.json` | ✅ 🧪 (structure) |
| Aucune publication automatique (pas de workflow, pas de script de publication) | ✅ |
| Vérification manuelle dans Paramètres (états, hors connexion, Expo Go) | ✅ 🧪 (logique pure testée) |
| Publication réelle, réception sur un téléphone, redémarrage | 📱 🔗 ☁️ **non testés** |

Aucune publication n'a été faite, aucun build cloud lancé, aucun compte distant modifié. **Il n'est pas affirmé que les mises à jour fonctionnent** : seul un build autonome réel recevant une vraie publication le prouvera.

## 2. Ce que fait l'application

Paramètres → **Mises à jour** : version, numéro de build (s'il est connu), canal, dernière vérification, bouton « Vérifier les mises à jour ».

| État affiché | Quand |
| --- | --- |
| « Pas encore vérifié » | ouverture, application installée |
| « Vérification en cours… » / « Téléchargement en cours… » | pendant l'opération (le bouton ne peut pas être relancé) |
| « Sovmilo est à jour » | aucune mise à jour compatible |
| « Mise à jour téléchargée, prête à être appliquée » | téléchargée **et vérifiée par expo-updates** ; le bouton « Redémarrer pour appliquer » apparaît |
| « Aucune connexion : réessayez plus tard » | échec réseau (hors connexion, hôte introuvable, délai dépassé) |
| « La vérification a échoué » | toute autre erreur (manifeste invalide, fichier corrompu…) ; rien n'est appliqué |
| « Les mises à jour sont disponibles dans l'application installée. » | **Expo Go** : aucune action proposée, aucune API native appelée |
| « Indisponible dans une version de développement. » | `__DEV__` |
| « Les mises à jour ne sont pas activées dans cette version. » | application installée sans `updates.url` (pas de projectId) |

Principes :

- **Télécharger n'applique rien.** Le redémarrage est une action séparée, confirmée par un panneau (« Redémarrer Sovmilo ? … Vos données ne sont pas touchées. Terminez d'abord toute saisie en cours. »).
- **Refus pendant une sauvegarde ou une restauration** : le redémarrage est bloqué tant que le verrou de maintenance de la base (`src/db/maintenance.ts`) est pris, avec un message. Le bouton n'est de toute façon proposé qu'après un téléchargement réussi, sur l'écran Paramètres (aucune saisie de formulaire n'y est possible).
- **Aucune vérification automatique** (`checkAutomatically: NEVER`) : rien ne se télécharge ni ne change au démarrage sans action de l'utilisatrice. Une mise à jour téléchargée mais non appliquée s'applique aussi au prochain démarrage à froid de l'application. Si l'on préfère un confort sans bouton (vérification au lancement), c'est une décision à prendre : passer à `ON_LOAD` dans `app.config.ts`, en sachant que la mise à jour s'applique alors au démarrage suivant sans confirmation.
- Pas de faux succès : aucun état « à jour » ou « téléchargée » n'est simulé quand l'API native n'est pas utilisable.

## 3. Version d'exécution : politique `fingerprint`

Une build n'accepte que les mises à jour de **même `runtimeVersion`**. Avec la politique `fingerprint`, cette valeur est une empreinte calculée sur ce qui touche au code natif (modules, plugins, configuration Android/iOS, nom de paquet…).

Conséquences :

- Une modification **JavaScript seule** (écrans, textes, calculs) ne change pas l'empreinte : la mise à jour arrive sur les builds existantes.
- Ajouter ou mettre à jour un **module natif**, changer un plugin ou la configuration native change l'empreinte : la mise à jour ne sera **pas** proposée aux anciennes builds, qui continuent de fonctionner telles quelles. Il faut alors un nouvel APK, installé par-dessus.
- Un JavaScript qui attendrait un module natif absent n'est ainsi jamais livré à une build qui ne l'a pas : c'est la raison du choix (contre `appVersion`, qui suppose de penser à augmenter la version à la main).
- Préview et production ont des empreintes **différentes** (le paquet en fait partie) : mesuré localement le 02/11/2026. Séparation des canaux **et** des versions d'exécution.
- Contrôle local, sans compte : `npx expo-updates fingerprint:generate --platform android`. À lancer avant de publier : si l'empreinte a changé depuis la build installée, **une mise à jour OTA n'atteindra pas ce téléphone**.

## 4. Canaux et branches

- Un canal est écrit dans chaque build par son profil EAS : `preview` → canal `preview`, `production` → canal `production`.
- Une publication vise un canal, par exemple (à vérifier avec `npx eas-cli update --help`, les options pouvant évoluer) :

```powershell
npx eas-cli update --channel preview --message "Description courte"
```

- Ne jamais publier directement sur `production` sans être passé par `preview` (§ 7). Il n'y a ni publication automatique au `push`, ni script qui publie.

## 5. Mises à jour et base de données : règles impératives

La base SQLite est locale et **n'est jamais supprimée** par une mise à jour. Au démarrage, l'application applique les migrations manquantes (`src/app/_layout.tsx`).

1. **Migrations additives uniquement dans une mise à jour OTA** : nouvelles tables, nouvelles colonnes avec valeur par défaut ou nulles. Jamais de suppression, renommage ou changement de type de colonne livré par OTA (cela exigerait de reconstruire des données, donc un nouvel APK et une procédure de migration testée).
2. **Une migration OTA est irréversible.** Un retour arrière (§ 8) remet l'ancien JavaScript, mais la base garde son nouveau schéma. L'ancien code fonctionne sur un schéma additif plus récent (les colonnes en plus lui sont inconnues) ; il ne fonctionnerait pas sur une migration destructive.
3. **Avant de publier une version qui migre** (nouveau fichier dans `src/db/migrations/`) : faire une sauvegarde (Paramètres → Sauvegarder mes données) sur le téléphone de test et sur celui de la famille, et la ranger hors de l'application. **Aucune sauvegarde automatique avant migration n'est implémentée dans l'application** (limite connue, § 9).
4. Une sauvegarde faite avec une version **plus récente** que l'application est **refusée** (jamais de migration à rebours). Après un retour arrière de code vers un ancien JavaScript, ne pas restaurer de sauvegarde plus récente.
5. Chaque nouvelle migration doit rester testée sur les anciens schémas (`src/features/backup/backup.test.ts`, anciens schémas 1 à 4 vers le schéma courant).

## 6. Que faire si une mise à jour est mauvaise

1. Ne pas paniquer et **ne pas désinstaller** : les données sont dans la base de l'appareil.
2. Publier un nouveau correctif (la solution normale), ou republier la mise à jour précédente sur le canal concerné (commande `eas update:republish` ou retour arrière du canal : voir `npx eas-cli update --help` pour les noms exacts dans la version de l'outil installée). ☁️ 👤
3. Si l'application ne démarre plus : expo-updates conserve la version embarquée dans l'APK et prévoit une reprise après plantage au démarrage (comportement de la bibliothèque, **non vérifié ici**). Si elle reste inutilisable, réinstaller l'APK **par-dessus** (sans désinstaller), puis, si les données manquent, restaurer la dernière sauvegarde.
4. Si une restauration échoue et que le retour automatique ne peut pas être vérifié (« Restauration incomplète ») : ne pas désinstaller, ne pas réessayer en boucle. Une **copie de sécurité** des données d'avant la restauration reste dans le stockage privé de l'application (`sovmilo-avant-restauration.db`, écrasée à la restauration suivante) ; la sortir demande l'aide du développeur.

## 7. Protocole de publication

Chaque étape doit réussir avant la suivante. Aucune n'a encore été exécutée.

1. **Test local** : `npx tsc --noEmit`, `npx expo lint`, `npx jest`, `npx expo export --platform android` (voir `docs/android-distribution.md` § 6). Lancer `npx expo-updates fingerprint:generate --platform android` et comparer avec la build installée : si l'empreinte a changé, l'OTA ne passera pas, faire un APK.
2. **Compatibilité de la base** : la version contient-elle une nouvelle migration ? Si oui, vérifier qu'elle est additive, que les tests d'anciens schémas passent, et faire une sauvegarde (§ 5).
3. **Publication `preview`** : `eas update --channel preview` ☁️ 👤.
4. **Validation sur le téléphone du développeur** (build preview, `app.sovmilo.preview`) : Paramètres → Vérifier les mises à jour → « Mise à jour téléchargée » → Redémarrer → les données sont intactes, la nouveauté est visible.
5. **Publication `production`** : seulement si l'étape 4 est parfaite. Même message de description. ☁️ 👤
6. **Validation sur le téléphone de la mère** (ou celui qui fait office de téléphone familial) : sauvegarde récente existante, vérification des mises à jour, redémarrage, contrôle des données selon le § 10 de `docs/android-distribution.md`.

## 8. Retour arrière : ce qu'il fait et ne fait pas

- Fait : remettre un ancien JavaScript sur un canal. Les téléphones le reçoivent à leur prochaine vérification.
- Ne fait pas : annuler une migration de base (§ 5), restaurer des données, ni corriger un APK.
- Après un retour arrière **avec** migration préalable, l'ancien code tourne sur la base migrée : acceptable seulement parce que les migrations OTA sont additives.

## 9. Limites connues

- Aucune sauvegarde automatique avant une migration ; la sauvegarde manuelle de l'étape 2 du protocole en tient lieu. Une amélioration possible (copie de sécurité interne avant d'appliquer une migration) n'est pas faite.
- La logique de mise à jour est testée avec une API simulée ; l'API réelle (`checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`) n'a pas pu être exercée sans build autonome ni publication.
- Le numéro de build affiché vient de la configuration embarquée (`versionCode`), pas du système.
- Détection d'Expo Go par `Constants.executionEnvironment` : à confirmer sur un téléphone.
