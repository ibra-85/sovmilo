# Distribution Android de Sovmilo (Lot 7)

Objectif : une application **autonome** (APK signé, identité stable) qui s'installe **par-dessus** la précédente en gardant les données, avec des mises à jour qu'on contrôle. Ce document dit ce qui est **fait**, ce qui est **vérifié automatiquement**, et ce qui **ne peut l'être que sur un vrai téléphone ou avec le compte Expo**.

Légende utilisée partout : ✅ implémenté · 🧪 validé automatiquement (tests ou commande locale) · 👤 action du propriétaire · 📱 à valider sur un téléphone · 🔗 dépend d'une build autonome · ☁️ nécessite le compte Expo.

## 1. État en un coup d'œil

| Élément | État |
| --- | --- |
| Paquet familial `app.sovmilo`, inchangé | ✅ 🧪 (`config/distribution.test.ts`) |
| Variante `preview` (`app.sovmilo.preview`) | ✅ 🧪 |
| `versionCode` | ✅ valeur de départ `1` ; compteur réel géré par EAS (`appVersionSource: remote`) ☁️ |
| `eas.json` : profils `preview` et `production`, APK, canaux séparés | ✅ 🧪 (structure) |
| Clé de signature | 👤 ☁️ créée au premier build de production, **pas encore faite** |
| Build APK réel | 👤 ☁️ **non lancé** (aucun build cloud sans accord) |
| Installation par-dessus une version précédente | 📱 🔗 non testée |
| Export de sauvegarde / restauration sur l'APK | 📱 🔗 non testés (voir `docs/backup-restore.md` § 9) |
| Mises à jour EAS Update | 📱 🔗 ☁️ non testées (voir `docs/eas-updates.md`) |

Tant que les lignes « non testé » ne sont pas validées sur une installation autonome réelle, **la distribution familiale n'est pas déclarée prête** (voir § 12).

## 2. Identité Android

| | Production (famille) | Preview (essais du développeur) |
| --- | --- | --- |
| Variable de build | `APP_VARIANT=production` (ou absente) | `APP_VARIANT=preview` |
| Nom de paquet Android | `app.sovmilo` | `app.sovmilo.preview` |
| Identifiant iOS | `app.sovmilo` | `app.sovmilo.preview` |
| Nom affiché | Sovmilo | Sovmilo (preview) |
| Schéma de lien | `sovmilo` | `sovmilo-preview` |
| Canal de mise à jour | `production` | `preview` |
| Données | celles de la famille | **séparées** : une autre application pour Android |

- `app.json` reste la source lisible de l'identité ; `app.config.ts` n'ajoute que la variante, `versionCode`, `runtimeVersion` et `updates`. Le nom de paquet de production n'a **pas** été changé et ne doit l'être qu'avec une décision explicite : un autre nom de paquet = une autre application pour Android = installation à côté, donc **toutes les données restent dans l'ancienne** (il faudrait passer par une sauvegarde).
- La variante preview permet d'essayer une build ou une mise à jour sans jamais toucher à l'installation de la mère. Contrepartie : ses données ne sont pas celles de l'application familiale (on y restaure une sauvegarde pour tester).
- Les icônes, l'icône adaptative et l'écran de lancement existants sont réutilisés tels quels (un test vérifie que les fichiers référencés existent). Aucune image n'a été créée.

## 3. Signature : ce qui rend l'installation « par-dessus » possible

Android n'installe une nouvelle version par-dessus l'ancienne que si **trois choses** sont identiques ou croissantes :

1. même **nom de paquet** (`app.sovmilo`) ;
2. même **clé de signature** ;
3. **`versionCode` plus grand** (EAS l'incrémente à chaque build de production : `autoIncrement: true`).

Si la clé change, Android refuse la mise à jour (« conflit avec un paquet existant »). La seule issue est de **désinstaller** l'application, ce qui **supprime ses données**. Perdre la clé, c'est donc perdre la possibilité de mettre à jour sans effacer les données (la sauvegarde du Lot 7 est le filet de sécurité, pas un remède à la perte de clé).

Recommandation : **laisser EAS créer et conserver la clé** (« keystore géré par Expo ») au premier build de production, puis **en garder une copie hors ligne** :

- Au premier `eas build --profile production`, répondre « oui » à la création d'une clé Android. 👤 ☁️
- Juste après : `npx eas-cli credentials --platform android`, option de téléchargement de la clé, puis ranger le fichier et les mots de passe affichés **dans un gestionnaire de mots de passe ou un coffre hors ligne**, jamais dans le dépôt, jamais dans un message. 👤 ☁️ (les libellés exacts des menus dépendent de la version de l'outil : les lire à l'écran.)
- Le dépôt ignore `*.keystore`, `credentials.json`, `*.apk`, `*.aab`, `*.db` et `sovmilo-backup-*` (testé). Aucun secret n'est dans `eas.json`, `app.json` ni `app.config.ts` (testé).
- Pour un éventuel dépôt sur Google Play plus tard, la gestion de clé devra être revue (signature par Google Play, clé d'envoi) : à étudier à ce moment-là, rien n'est fait ici.

## 4. Profils EAS (`eas.json`)

- `cli.appVersionSource: remote` : EAS tient le compteur de `versionCode`.
- `preview` : `distribution: internal`, `channel: preview`, `APP_VARIANT=preview`, **APK**.
- `production` : `distribution: internal`, `channel: production`, `APP_VARIANT=production`, **APK**, `autoIncrement: true`.
- Pas de profil `development` : un profil de développement exige le client de développement (`expo-dev-client`), non installé. Le « développement » reste Expo Go (`npx expo start`). Ajouter ce client est une décision à part (dépendance native).
- APK et non AAB : l'APK s'envoie et s'installe directement. Le format AAB ne sert qu'au Play Store.
- Les valeurs `channel` sont **écrites dans la build** : une build `preview` ne reçoit que le canal `preview`, une build `production` que le canal `production`.

## 5. Ce que le propriétaire doit faire avec son compte Expo (une fois)

Rien n'a été exécuté de tout ceci. Aucun identifiant fictif n'est dans le dépôt : sans `projectId`, les mises à jour restent désactivées et l'application l'indique.

```powershell
npx eas-cli login
npx eas-cli init
```

`eas init` crée le projet Expo et doit écrire `extra.eas.projectId` (et `owner`) dans `app.json`. Si l'outil refuse d'écrire (configuration dynamique), ajouter ces deux valeurs à la main dans `app.json`. L'adresse de mise à jour est ensuite **calculée** par `app.config.ts` (`https://u.expo.dev/<projectId>`) ; il est inutile de lancer `eas update:configure`.

Puis, dans cet ordre :

```powershell
# 1. Build d'essai (paquet preview, canal preview)
npx eas-cli build --platform android --profile preview

# 2. Build familiale (paquet app.sovmilo, canal production) : crée la clé de signature la première fois
npx eas-cli build --platform android --profile production

# 3. Sauvegarde de la clé (voir § 3)
npx eas-cli credentials --platform android
```

L'APK se télécharge depuis le lien affiché ou la page du build. Sur le téléphone, Android demandera d'autoriser l'installation depuis le navigateur ou le gestionnaire de fichiers utilisé : à accepter une fois, puis à retirer si on le souhaite.

## 6. Contrôles locaux possibles sans compte (déjà faits)

- Configuration résolue des deux variantes : `npx expo config --type public --json` (production) et `$env:APP_VARIANT="preview"; npx expo config --type public --json`. Mesuré le 02/11/2026 : paquet `app.sovmilo` / `app.sovmilo.preview`, `runtimeVersion` = `fingerprint`, aucune `updates.url`.
- Empreinte du code natif : `npx expo-updates fingerprint:generate --platform android`. Mesuré le 02/11/2026 : **deux empreintes différentes** pour production et preview (les builds preview ne peuvent donc pas recevoir des mises à jour destinées à la production, en plus de la séparation des canaux). Les valeurs changent dès qu'un module natif ou la configuration change ; elles ne sont pas à recopier.
- Export du JavaScript Android : `npx expo export --platform android --output-dir "$env:TEMP\sovmilo-export"` : le paquet se construit (bytecode d'environ 5,8 Mo). Cela ne remplace pas un vrai build natif.

## 7. Installer l'APK sans perdre l'ancienne installation

1. **Ne pas désinstaller Expo Go.** L'APK autonome est une autre application (`app.sovmilo`), les deux coexistent.
2. Installer l'APK. Ouvrir Sovmilo : base vide (les données d'Expo Go ne sont pas partagées).
3. Restaurer la sauvegarde faite dans Expo Go (§ 8).
4. N'envisager de retirer Expo Go qu'après le protocole de comparaison (§ 10).

Pour toutes les installations suivantes : installer le nouvel APK **par-dessus** (sans désinstaller). Si Android affiche « application non installée / conflit », **ne pas désinstaller** : c'est le signe d'une clé ou d'un paquet différent, il faut d'abord faire une sauvegarde depuis l'application déjà installée (Paramètres → Sauvegarder mes données), puis chercher la cause.

## 8. Parcours Expo Go → application autonome

Détail technique : `docs/backup-restore.md` § 8. En résumé :

1. Expo Go : Paramètres → Données et sauvegardes → Sauvegarder mes données → dossier Téléchargements.
2. Vérifier la présence du fichier `sovmilo-backup-AAAA-MM-JJ-HHMM.db` dans le gestionnaire de fichiers.
3. Copier aussi ce fichier ailleurs (ordinateur ou Drive personnel) : c'est la seule copie tant que la restauration n'est pas vérifiée.
4. Installer l'APK, ouvrir, Paramètres → Restaurer une sauvegarde, choisir le fichier, lire l'aperçu, confirmer.
5. Comparer (§ 10).

Disponibilité dans Expo Go : `expo-sqlite` et `expo-file-system` y sont fournis ; la sauvegarde ne dépend d'aucun module natif ajouté. Les mises à jour, elles, **ne sont pas disponibles dans Expo Go** : la section affiche « Les mises à jour sont disponibles dans l'application installée. » et ne propose aucune action.

## 9. Mises à jour et sécurité des données

Voir `docs/eas-updates.md`. Règle de fond : une mise à jour n'efface jamais de données financières (migrations additives, aucune suppression de table ou de colonne) ; un retour en arrière d'une mise à jour **n'annule pas** une migration de base.

## 10. Protocole de comparaison avant / après

À faire à chaque changement d'installation (Expo Go → APK, APK → APK, avant de retirer Expo Go).

**Avant** (sur l'ancienne installation) : noter sur papier ou en photo :

- Accueil : « reste à dépenser » du mois courant ;
- nombre d'opérations du mois (Opérations) et les trois dernières (libellé, montant, date) ;
- une catégorie personnalisée, un budget (catégorie, montant) ;
- solde déclaré (Services) ;
- une liste de courses avec un article coché ;
- une facture (une payée, une à payer) ;
- un objectif d'épargne et son montant épargné ;
- langue et thème choisis.

**Pendant** : sauvegarde (Parcours 1), installation, restauration (Parcours 2). L'aperçu de restauration affiche les nombres lus dans le fichier (opérations, catégories, budgets, soldes déclarés, listes, articles, factures, échéances, objectifs, versements) : **les noter et les comparer** avec l'ancienne installation.

**Après** (sur la nouvelle installation) : retrouver chaque élément noté ; le « reste à dépenser » doit être **identique au centime** ; la langue et le thème doivent être ceux de la sauvegarde. Redémarrer l'application (la fermer complètement depuis les applications récentes) et revérifier : les données doivent rester.

Si une différence apparaît : ne rien supprimer, ne pas retirer Expo Go, garder le fichier de sauvegarde, et contacter la personne qui développe Sovmilo.

## 11. Liste de contrôle à exécuter sur le téléphone Android

Aucune de ces étapes n'a été exécutée par l'assistant (pas d'émulateur, pas d'application lancée). Cocher au fur et à mesure.

**Parcours 1 — Sauvegarder** (Expo Go d'abord, puis APK)
- [ ] Paramètres → Données et sauvegardes : les deux actions sont visibles, texte lisible, mention « Aucune sauvegarde enregistrée ».
- [ ] « Sauvegarder mes données » : l'avertissement « non chiffré » s'affiche avec Annuler / Choisir le dossier.
- [ ] Annuler : rien ne se passe, aucune date affichée.
- [ ] Choisir le dossier (Téléchargements) : panneau de progression, puis « Sauvegarde enregistrée » avec le nom du fichier.
- [ ] Le fichier existe dans le gestionnaire de fichiers, son nom se termine par `.db` (**si Android a changé l'extension, le noter**), sa taille est plausible (quelques dizaines de Ko et plus).
- [ ] « Dernière sauvegarde enregistrée » affiche la bonne date.
- [ ] Refaire en fermant le sélecteur sans choisir : message « Aucun fichier enregistré », date inchangée.

**Parcours 2 — Restaurer** (sur un appareil ou une installation de test d'abord)
- [ ] « Restaurer une sauvegarde » → choisir le fichier : aperçu avec date, version, nombres, et la phrase « Cette restauration remplacera les données actuellement enregistrées sur cet appareil. »
- [ ] Annuler : rien n'est modifié.
- [ ] Confirmer « Remplacer mes données » : progression non fermable, puis « Données restaurées ».
- [ ] Accueil, Opérations, Budgets, Courses, Factures, Épargne montrent les données du fichier **sans redémarrer**.
- [ ] Fermer complètement l'application, rouvrir : les données sont toujours là.
- [ ] Langue et thème conformes à la sauvegarde.

**Parcours 3 — Fichier invalide**
- [ ] Choisir une photo ou un PDF : « Ce n'est pas une sauvegarde Sovmilo », données intactes.
- [ ] Choisir un fichier `.db` copié partiellement (couper un fichier en deux) : message « incomplet » ou « abîmé », données intactes.
- [ ] Fichier vide : message « Le fichier est vide ».

**Parcours 4 — Expo Go → APK**
- [ ] Faire le protocole du § 10 de bout en bout. Expo Go reste installé jusqu'à la fin.

**Parcours 5 — Mise à jour** (build preview avec un projet Expo configuré, voir `docs/eas-updates.md` § 7)
- [ ] Dans Expo Go : la section Mises à jour affiche « disponibles dans l'application installée », aucun bouton actif.
- [ ] Sur l'APK sans réseau : « Aucune connexion ».
- [ ] Sur l'APK avec réseau, sans mise à jour publiée : « Sovmilo est à jour ».
- [ ] Après publication sur le canal `preview` : « Mise à jour téléchargée », puis « Redémarrer pour appliquer » avec confirmation ; après redémarrage, les données sont intactes.
- [ ] Installer un nouvel APK **par-dessus** (versionCode supérieur) : l'application s'installe sans désinstallation, les données sont intactes.

## 12. Conditions pour déclarer Sovmilo prêt pour le téléphone de la mère

Tout doit être vrai **et vérifié sur une installation autonome réelle** :

1. un APK de production signé avec la clé EAS, **clé sauvegardée hors ligne** ;
2. Parcours 1 à 3 réussis sur cet APK, avec le protocole § 10 sans écart ;
3. un deuxième APK de production (versionCode supérieur) installé **par-dessus** le premier, données intactes ;
4. la sauvegarde conservée à deux endroits hors de l'application, restauration essayée au moins une fois sur un autre appareil ou une installation preview ;
5. une mise à jour OTA publiée sur `preview`, validée sur le téléphone du développeur, puis publiée sur `production` et validée (docs/eas-updates.md § 7), si l'on veut les utiliser ;
6. la mère sait où se trouve « Sauvegarder mes données » et une sauvegarde récente existe avant chaque mise à jour importante.

Tant que l'un de ces points manque, la distribution reste en bêta du développeur.
