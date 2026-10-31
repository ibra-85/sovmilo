# Écarts entre l'application et les maquettes « Precision Glass »

Ce document liste, honnêtement, tout ce qui diffère de `design/` (source de vérité visuelle), pourquoi, et ce qui reste à décider.
Rien ici n'a été vérifié sur un appareil Android : les écarts de rendu éventuels (ombres, animations, clavier) sont à constater lors des tests.

Légende : **choix** = décision prise pour la lisibilité ou la technique ; **proposition** = valeur inventée là où les maquettes ne disent rien ; **ouvert** = décision qui revient au propriétaire.

## 1. Icônes

| Sujet | Maquette | Application | Statut |
|---|---|---|---|
| Famille | SVG dessinés pour les maquettes | **Hugeicons Free, Stroke Rounded**, via `src/components/ui/icon.tsx` et le catalogue `icons.ts` | choix (demandé) |
| Équivalents | — | Opérations = `ArrowDataTransferVertical`, santé = trousse de secours, Services = grille, etc. : équivalents les plus proches, pas des copies | choix |
| Épaisseur du trait | 1,8–2,2 | 1,8 (normal), 2,1 (actif, coche, +, ×) | choix |
| Catégories | icône SVG ou emoji | `icon:<id>` (catalogue de 15) ou emoji natif ; valeur illisible → icône « étiquette » | choix |

## 2. Dimensions

Les rayons et espacements sont ceux **mesurés** sur les maquettes validées (par rôle, dans `src/theme/layout.ts`). Les repères « espacement 24 / rayon 23 » d'une image d'inspiration n'ont **pas** été appliqués : ce sont des recommandations, pas des mesures.

| Sujet | Maquette | Application | Statut |
|---|---|---|---|
| Zone tactile d'un onglet inactif | « 48 dp » annoncé, 44 dp dessinés | zone de 44–49 dp de large × 60 dp de haut (la barre entière) ; 66 dp en icônes seules | choix, **à vérifier** : sous 48 dp en largeur à partir de certaines langues/tailles |
| Position de la barre | 32 dp au-dessus du bas | `max(32, zone des gestes + 12)` dp | choix |
| Accueil V6.1 | validé | non modifié ; pas de grille 2×2 | décision du propriétaire |

## 3. Typographie (lisibilité)

L'utilisatrice principale est peu habituée aux applis : aucun texte d'information sous 14 sp.

| Rôle | Maquette | Application |
|---|---|---|
| Légende | 13 | **14** |
| Texte secondaire | 14 | **15** |
| Micro (graphiques, libellés de tuile) | 12 | **13** |
| Libellé de navigation | 14 | 14, plafonné à 130 % |
| Notification | 14 | **15** |

Le texte suit le réglage de taille d'Android jusqu'à 180 % (montants : 110–115 %). À partir de **130 %**, la barre de navigation n'affiche plus que les icônes (dessiné dans la maquette). `CLAUDE.md` demande ≥ 16 sp et ≥ 56 dp ; le design, 13–14 sp et 48 dp : **ouvert** (voir §7).

## 4. États et mouvements non dessinés (propositions)

- Bouton **désactivé** (`disabled` / `onDisabled`), **chargement** (icône remplacée par un indicateur), **focus clavier** (anneau de 3 dp), **erreur** de champ : propositions.
- Curseur de saisie **fixe** (pas de clignotement : « pas de mouvement permanent »).
- Squelettes **statiques** (fondu d'apparition de 150 ms, pas de reflet qui balaie).
- Toutes les durées et courbes de `src/theme/motion.ts` sauf celles marquées DÉCIDÉ dans `design/MOTION.md`.
- Libellé d'onglet : le fondu suit la progression de la pastille (visible dès 40 % du trajet) au lieu d'un fondu de 120 ms décalé de 80 ms ; effet équivalent, une seule animation à interrompre.
- Pastille d'onglet : interpolation linéaire entre ses deux positions de repos (une moyenne des bords reculait par moments, vu par un test).
- Pas de retour haptique (`expo-haptics` non installé). Pas d'info-bulle à l'appui long sur les onglets (TalkBack annonce déjà le nom).
- Agrandissement animé du panneau inférieur à l'ouverture d'un sélecteur (250 ms) : **non implémenté** (risque de conflit avec la remontée du clavier) ; la hauteur change sans transition.
- Notification avec action (« Annuler ») : **6 s** au lieu de 3 s, pour que l'action reste atteignable.

## 5. Structure

- Onglets : Accueil, Opérations, Budgets, **Services**. Les routes gardent leurs noms (`index`, `history`, `budget`, `more`). L'écran « Services » n'est pas dessiné : il héberge provisoirement l'ancien écran « Plus » (langue, réglages).
- Menu + : « Scanner un ticket » est montré **grisé avec « Bientôt »** et ne fait rien (le scan est prévu en V1.3). « Ajouter un revenu » ouvre `/add?type=income`.
- Une seule notification à la fois ; l'ancien `UndoProvider` est remplacé par `ToastProvider`.
- Lot 3 : tous les écrans sont refaits dans le design (Accueil V6.1, Opérations, Budgets, détail et formulaires d'opération et de budget, Services, solde réel). Les anciens composants (`big-button`, `chip`, `keypad`, `outline-button`, `screen`, `category-grid`, `date-field`, `undo-provider`) et le pont de couleurs `src/theme/colors.ts` sont supprimés ; NativeWind n'est plus utilisé par aucun écran (la configuration reste en place).

## 5 bis. Lot 3 : écarts et choix

- **Matière « Precision Glass » sans flou natif** : surface graphite semi-opaque, contour clair fin, reflet supérieur (dégradé SVG), liseré lumineux de 1 px et ombres douces (`src/theme/glass.ts`, `src/components/ui/glass-surface.tsx`). Appliquée aux éléments flottants uniquement (barre, bouton +, menu +, menus déroulants, panneaux inférieurs, notifications, dialogues). Le rendu est identique sur tous les appareils. Un vrai flou (`expo-blur`) demanderait une recompilation native et un essai sur Android (`BlurTargetView`) : à reprendre plus tard, la recette restera valable comme repli.
- **Libellé d'opération** : le design montre « Supermarché », mais l'application n'a pas de champ « libellé ». On affiche la **note** si elle existe, sinon le nom de la catégorie.
- **Moyen de paiement** : plus proposé dans le formulaire ni en filtre (le design n'a pas ce champ). « Carte » par défaut ; la valeur d'une opération existante est conservée à la modification ; l'épargne est enregistrée en « virement ».
- **Filtres de l'historique** : par moyen de paiement et par catégorie supprimés (non dessinés). Restent la recherche texte (note, catégorie, montant) et Tout / Dépenses / Revenus.
- **Épargne** : le bouton « Mettre de côté » est dans Services (il ouvre le formulaire en mode `transfer`), plus sur l'Accueil.
- **Type d'opération** : plus de sélecteur dans le formulaire ; il vient du point d'entrée (menu +, Services). Le type ne change pas à la modification.
- **Sélecteur de période** : la maquette montre un bouton sans panneau. On propose une liste des 12 derniers mois ; le mois choisi est partagé par Accueil, Opérations et Budgets.
- **Semaines du graphique** : tranches 1–7, 8–14, 15–21, 22–fin du mois.
- **Seuil « presque atteint »** : 80 % conservé (le design propose 75 %).
- **Clavier et formulaires** : `KeyboardAvoidingView` en mode `padding` sur Android et iOS ; le bouton principal reste visible au-dessus du clavier. **À vérifier sur le téléphone** (HyperOS, edge-to-edge).
- **Sélecteur de date** : celui du système (calendrier Android, panneau avec calendrier sur iOS) ; le design ne dessine pas ce panneau.
- **Services et solde réel** : non dessinés ; composés avec les éléments du design system.

## 5 ter. Règle : ne jamais utiliser `ImageBackground`

React Native 0.88 a déprécié `ImageBackground` (avertissement « ImageBackground is deprecated and will be removed in a future release »).

- **Dans notre code** : ne jamais l'utiliser. Pour une image de fond, mettre une `View` avec une `Image` en position absolue (`StyleSheet.absoluteFill`) sous le contenu.
- **Cause réelle de l'avertissement rencontré** : pas notre code, mais NativeWind. `react-native-css-interop` (0.2.x) lit `ImageBackground` au démarrage (`dist/runtime/components.js`, appelé par `wrap-jsx.js`) pour lui ajouter la prise en charge de `className`.
- **Solution en place** : `metro.config.js` redirige uniquement l'import `./components` de `wrap-jsx.js` vers `config/css-interop-components.js`, une copie du fichier d'origine sans `ImageBackground`. Vérifié le 31/10/2026 par un export Android sans bytecode : il ne reste que la définition interne de React Native, plus aucun accès.
- **À refaire quand on met à jour NativeWind / css-interop** : comparer `node_modules/react-native-css-interop/dist/runtime/components.js` avec la copie, ou retirer la redirection si la version corrigée n'accède plus à `ImageBackground`. Si NativeWind n'est plus utilisé, supprimer la redirection et `config/`.

## 6. Couleurs provisoires

Les couleurs d'alerte (`danger*`) ne sont pas fixées par les maquettes : provisoires. L'accent citron clair `#DDF35D` (clair) est un jeton de réserve.

## 7. Décisions ouvertes (à trancher par le propriétaire)

1. **Report des limites de budget d'un mois sur l'autre** : implémenté à l'étape 2a (les limites se reportent), **jamais confirmé**. Non modifié.
2. **Seuil « presque atteint »** : le domaine utilise 80 % (étape 2a) ; le design propose 75 % (fictif).
3. **Contenu de l'onglet Services** : provisoirement solde réel, épargne et langue.
4. **Épargne (virement)** : absente des maquettes, conservée dans le domaine ; son bouton est dans Services.
5. **Taille du texte et des cibles** : `CLAUDE.md` (≥ 16 sp, ≥ 56 dp) contre design (13–14 sp, 48 dp).
6. **Modèle des catégories** : le design propose Courses / Santé / Factures / Transport / Maison, sans couleur ; la base contient 10 catégories avec emoji et couleur. Migration à prévoir au lot 3.
7. **Traductions russes** écrites par l'assistant : à relire par un locuteur.
8. **Scan de ticket** : parcours non conçu.
9. **Confirmation de suppression non glissable pendant l'action** : « à confirmer » dans les maquettes ; choix prudent (non fermable).
