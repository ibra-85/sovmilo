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
- **Semaines du graphique** : tranches 1–7, 8–14, 15–21, 22–fin du mois ; la dernière tranche va du 22 à la fin du mois, soit 7 jours (février non bissextile, 22–28) à 10 jours (mois de 31 jours, 22–31). Calcul inchangé (`domain/weekly.ts`) ; seuls les libellés sont courts (« 22–31 »), la phrase complète (« 22–31 octobre ») va à TalkBack.
- **Seuil « presque atteint »** : 80 % conservé (le design propose 75 %), PROVISOIRE. Lot 3.1 : un budget à exactement 100 % n'est plus « presque atteint » mais « atteint » (`reached`), distinct de « dépassé » (> 100 %). Statuts : ok / near / reached / over (`domain/budget.ts`).
- **Clavier et formulaires** : `KeyboardAvoidingView` en mode `padding` sur Android et iOS ; le bouton principal reste visible au-dessus du clavier. **À vérifier sur le téléphone** (HyperOS, edge-to-edge).
- **Sélecteur de date** : celui du système (calendrier Android, panneau avec calendrier sur iOS) ; le design ne dessine pas ce panneau.
- **Services et solde réel** : non dessinés ; composés avec les éléments du design system.

## 5 quater. Lot 3.1 : mouvement, thème, catégories

- **Flash blanc au retour** : cause = le fond natif de la fenêtre Android (blanc par défaut) visible entre deux écrans. Corrigé à la racine : `expo-system-ui` (`setBackgroundColorAsync`) et `View` racine à la couleur du thème. Aucun calque artificiel. **À valider sur le téléphone** (voir la liste ci-dessous).
- **Popover V3** (`MorphingPopover`) : le bouton SE TRANSFORME en menu, avec UNE seule surface visible pendant toute l'interaction. **Cause de la duplication en V2 (confirmée dans le code)** : la surface vivait dans un `Modal` (seconde fenêtre Android, créée de façon asynchrone) alors que le vrai déclencheur restait visible dessous, avec son ombre de tuile, que la copie ne reproduisait pas ; la copie apparaissait donc au-dessus d'un bouton encore là, et le fond du menu, semi-transparent en fin de course, laissait voir le bouton sous lui. **V3** : (1) la surface est rendue dans un hôte (`popover-host.tsx`, posé à la racine dans `_layout.tsx`), AU-DESSUS de l'application, dans la même fenêtre native, sans `Modal` ; l'origine réelle de l'hôte est mesurée pour que les rectangles de `measureInWindow` restent exacts ; (2) à l'ouverture, dans le MÊME rendu React, l'hôte reçoit la surface et le déclencheur est masqué (`anchor.cover(true)`, opacité 0 : ni fond, ni contour, ni ombre, ni icône) ; (3) la surface reproduit le déclencheur (fond, contour, rayon, ombre portée sur une couche séparée, contenu `triggerContent` posé au-dessus et immobile) ; (4) à la fermeture, quand le moteur est au repos sur « fermé », le déclencheur réapparaît et la surface disparaît dans le même rendu : deux images identiques, aucun délai à régler. Les consommateurs branchent `coverStyle` (de `usePopoverTrigger` / `useAnchorMeasure`) sur la vue qui porte la référence du déclencheur ; `CategoryTile` a `covered`. **Coût du mouvement** : une seule vue change de mise en page (la surface : position et taille) ; les ombres (déclencheur et menu), le reflet, les lignes et le contenu du déclencheur n'animent que opacité ou transformation (`scaleBetween`), et ne sont jamais redessinés à une autre taille. Découpage : état et démontage (`morphing-popover.tsx`, `popover-session.ts`), couche d'affichage (`popover-host.tsx`), géométrie (`popover-layout.ts`), moteur (`hooks/use-popover-engine.ts`, `popover-motion.ts`), présentation (`popover-menu.tsx`), mesure du déclencheur (`popover-trigger.ts`). Fermeture : toucher à côté ou sur le déclencheur (bascule), Retour d'Android (toujours absorbé tant que la surface existe), choix d'une ligne ; l'action choisie s'exécute UNE fois, quand la fermeture est terminée. Un toucher sur le déclencheur pendant la fermeture rouvre le menu (`onReopen`). **Garde anti double-toucher** : les lignes n'acceptent un choix que 260 ms après l'ordre d'ouverture (`SELECT_ARM_MS`) ; avant, un toucher sur une ligne ferme le menu (en mode `cover` la première ligne est exactement sous le bouton). Animations réduites : le menu se pose À CÔTÉ du déclencheur (qui reste visible, aucun masquage) et apparaît en fondu de 100 ms, sans mouvement. Pas de flou natif. **Limites** : le menu recouvre le déclencheur ; rotation ou changement de largeur de la fenêtre → fermeture (mesure périmée) ; l'hôte est à la racine : sur iOS, un écran présenté en modal natif (`presentation: "modal"`) passerait AU-DESSUS de l'hôte (sur Android, ces écrans sont dans la même hiérarchie et restent dessous) — à traiter au moment de la version iOS en posant un `PopoverHostProvider` dans ces écrans ; un déclencheur sélectionné (tuile avec coche ou halo) est reproduit sans sa coche ni son halo : la coche réapparaît au retour du déclencheur.
- **Moteur de mouvement du popover** : pas de `withSpring`. Le code de Reanimated 4.7.1 (`animation/spring/spring.ts`) annule la vitesse quand la nouvelle cible va à contre-sens (« Inertia is only preserved when it already points toward toValue »). Le popover calcule donc lui-même un ressort à amortissement critique (`stepMotion`, solution exacte, indépendante de la durée de l'image), image par image sur le thread UI (`useFrameCallback`) ; l'état (position + vitesse) n'est jamais remis à zéro. **Révisé en V3** : la V2 cascadait deux ressorts dans tous les cas, ce qui retardait le départ (calcul du modèle : 10 % à 50 ms, 50 % à 104 ms, calé en 288 ms pour 220 ms demandées). En V3, le premier étage (`lead`) est calé sur la cible quand tout est au repos : le départ est celui d'UN seul ressort (10 % à ~25 ms, 50 % à ~60 ms, calé en ~250 ms avec le seuil de repos) ; il ne sert qu'à adoucir une INVERSION en plein mouvement (demi-tour en deux à trois images, avec jusqu'à ~15 % de course encore parcourue à mi-chemin). **Honnêtement** : la position et la vitesse sont continues dans le modèle, mais à l'écran l'inversion est un adoucissement de quelques dizaines de millisecondes, pas une vraie inertie. Ces chiffres viennent du modèle mathématique testé sous Jest, PAS d'une mesure sur appareil : la fluidité réelle (images par seconde) reste **à valider sur le téléphone**, de préférence avec une build de type release. Les autres animations (`usePresence`, panneau inférieur, notification) restent sur `withSpring`, avec la limite ci-dessous.
- **Ressorts** (`useMotion().spring(...)`, hors popover) : Reanimated `withSpring`, durée + amortissement 1, sans rebond. Interruptible : la position reste continue. **Limite réelle** : la vitesse en cours est conservée quand la nouvelle cible va dans le même sens ; si le sens s'inverse, Reanimated remet la vitesse à zéro (la position, elle, ne saute jamais). La durée réelle d'un ressort ≈ 1,5 × la durée « perçue » (`SPRING_REAL_DURATION_RATIO`).
- **Thème** : source unique = `Appearance.setColorScheme` (« Système » = `'auto'`), préférence mémorisée dans `expo-sqlite/kv-store` (lecture synchrone avant le premier rendu : pas de flash du mauvais thème). « Système » suit Android, y compris en cours d'utilisation. Réglage dans Services → Paramètres, avec la langue.
- **Services** : Solde manuel, Épargne, Catégories, Paramètres ; Factures, Courses, Statistiques sont des lignes atténuées « Bientôt », non touchables (aucune fausse interaction).
- **Catégories personnalisées** : se distinguent des catégories par défaut par `nameKey === null` (pas de colonne en plus). Modifier : même panneau que « Nouvelle catégorie », même identifiant donc opérations et budgets suivent. Supprimer : confirmation explicite. Catégorie utilisée → **réaffectation** (décision du propriétaire, 31/10/2026) : un panneau demande la catégorie du même type qui reçoit les opérations (y compris celles supprimées « annulables ») ; les budgets de la catégorie supprimée sont retirés (le budget de la cible n'est jamais modifié) ; le panneau annonce les nombres avant le bouton « Déplacer et supprimer » ; une seule transaction SQL, tout ou rien (`deleteCategory` dans `features/categories/repository.ts`). Aucune opération n'est jamais supprimée. Les catégories par défaut ne se modifient ni ne se suppriment. Sort des budgets **confirmé le 31/10/2026** : ils sont retirés, pas fusionnés dans la cible.
- **Accueil** : les cellules Revenus et Dépenses ouvrent Opérations avec le filtre correspondant (période conservée, même filtre que le sélecteur Tout / Dépenses / Revenus : `hooks/use-operations-filter.ts`).
- **Notification et zones système** : la notification se pose au-dessus de la barre flottante, ou au-dessus du clavier quand il est ouvert (`toastBottom`, testé).
- **Contrastes** : la palette est testée (WCAG AA 4,5:1) pour texte, texte secondaire, bouton principal et alerte, en clair et en sombre (`theme/palette-contrast.test.ts`).

### Liste de contrôle sur le téléphone (Lot 3.1)

Flash blanc (clair ET sombre, avec « Système » aussi) : Accueil → Ajouter → Retour ; Opérations → Détail → Retour ; Détail → Modifier → Retour ; Budgets → Détail → Retour ; retour juste après la fermeture d'un panneau.
Mouvement : ouvrir / refermer très vite le menu « ⋯ », le menu +, un panneau inférieur, la barre flottante et le sélecteur segmenté (retouche pendant l'animation : pas de saut). Menu « ⋯ » en haut de l'écran et près du bas : il ne couvre jamais l'en-tête, ne sort pas de l'écran.
Autre : graphique (libellés non coupés, texte agrandi, petit écran), budget à 100 %, notification avec clavier ouvert, confirmation de suppression avec un nom très long (et en russe), Paramètres (thème appliqué tout de suite, conservé après redémarrage, « Système » suit Android), appui long sur une catégorie personnalisée, Services → Catégories, bouton Retour d'Android sur chaque écran et panneau.

## 5 quinquies. Montants extrêmes : règles responsive

Règles (code : `src/theme/amount-fit.ts`, `amount-layout.ts`, `AmountText`) :

1. **Le € ne se sépare jamais de son nombre** : espace insécable (U+00A0) entre les deux, milliers en espace fine insécable (U+202F), « % » collé à son nombre dans les textes (fr : U+202F, ru : U+00A0). Un montant tient toujours sur UNE ligne.
2. **Réduction mesurée, bornée** : si `maxWidth` est donné, la taille est la plus grande qui tient (largeurs réelles d'Inter SemiBold, +4 % de marge), jamais sous une échelle minimale par taille : saisie / détail / focal 50–55 %, total 70 %, **ligne de liste 87,5 % (14 sp)**. Filet de sécurité : `adjustsFontSizeToFit` (minimum 70 %).
3. **Au-delà, la structure change** (pas la taille de toute l'interface) : cellule Revenus / Dépenses en pile, ligne de budget sur deux niveaux (nom puis montants), totaux du graphique empilés, valeurs sous les barres retirées sauf la barre choisie.
4. **Aucune abréviation** (pas de « 2 M€ », « 10 k€ ») : décision à demander si elle devient nécessaire.
5. Le texte agrandi du système est pris en compte (plafonné par le style, comme Android).

Budgets en alerte : 8 dp entre les cartes d'une même liste, contour d'alerte plus net (`dangerBorder`).
Menu contextuel : hauteur MESURÉE (libellés longs sur 2 lignes), icône centrée sur la première ligne, centré sous une tuile (appui long) ou aligné à droite d'un bouton « ⋯ ».
Panneau de déplacement d'une catégorie : zone défilante bornée à l'écran (zones système et texte agrandi), boutons toujours visibles.

**Couvert automatiquement** : mise en forme des 8 montants limites en fr et ru ; ajustement pour 6 zones à 360 dp ; texte agrandi ; échelles minimales ; géométrie du graphique (indicateur dans la carte, valeurs retirées) ; placement du popover (centré, bords) ; « % » insécable ; états de budget pour 0, 74, 100, 108, 200, 2040, 5100 %.
**À vérifier sur téléphone** (rendu réel, non testable sans appareil) : voir la liste donnée dans le bilan du 01/11/2026.

## 5 sexies. Lot 4 : module Courses

Écrans : Services → Courses (`/shopping`, liste des listes), détail d'une liste (`/shopping/[id]`), panneaux « Nouvel article / Modifier l'article » et « Nouvelle liste / Renommer ». Code : `src/features/shopping/`, calculs purs dans `src/domain/shopping.ts`, tables `shopping_lists` et `shopping_items` (migration `0002`, ajout seul : aucune table existante n'est touchée).

**Données** : quantité en MILLIÈMES d'unité (entier : 1,5 kg = 1500), prix unitaire en centimes (entier, `null` = pas de prix), unités pièce / kg / g / L / mL / paquet. Décimales (3 au plus) seulement pour kg et L. Grammes : le prix saisi est au kg ; millilitres : au litre (comme en rayon). Suppression logique (`deleted_at`), comme le reste de l'application. Pas de synchronisation dans ce lot.

**Règles de prix** (testées) :
1. Total d'une ligne = quantité × prix unitaire, arrondi UNE fois, à la moitié supérieure, en entiers (aucun nombre flottant) : 250 g à 4,20 €/kg = 1,05 € ; 0,5 kg à 3,35 €/kg = 1,68 €.
2. Le total estimé ne compte QUE les articles encore à acheter ET ayant un prix. Un article coché sort du total.
3. S'il manque des prix, l'écran écrit « Total partiel : N articles n'ont pas de prix ». Sans aucun prix, aucun total n'est affiché.
4. Cocher un article ne crée aucune opération et ne touche ni au solde ni aux budgets (test : le contenu de `transactions` est identique avant / après).

**Choix d'interface** : pas de liste créée d'office (pas de fausses données) ; bouton principal fixe en bas de chaque écran ; articles cochés rangés dans « Déjà pris (n) », jamais supprimés automatiquement, décochables ; aucun geste caché (toucher la ligne ouvre la modification, qui contient « Supprimer l'article ») ; suppression d'un article = immédiate avec « Annuler » dans la notification (6 s) ; suppression d'une liste = confirmation qui annonce le nombre d'articles.

**Couvert automatiquement** (Jest, vraie base SQLite) : validation des noms, quantités (virgule, point, décimales refusées, zéro, trop grand), prix, arrondis, articles sans prix, noms très longs, création / renommage / suppression de liste, ajout / modification / coche / décoche / suppression / restauration d'article, persistance après « redémarrage » (réouverture du fichier), migration sur une base contenant déjà des opérations, indépendance des opérations, parité et pluriels FR / RU (1, 2, 5, 11, 21, 22).
**À vérifier sur téléphone** (rendu et tactile, non testables sans appareil) : voir la liste donnée dans le bilan du lot 4.

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
3. **Contenu de l'onglet Services** : Solde manuel, Épargne, Catégories, Paramètres + Factures / Courses / Statistiques « Bientôt » (lot 3.1).
10. **Catégorie utilisée** : réaffectation des opérations, budgets retirés — décidé et confirmé le 31/10/2026.
4. **Épargne (virement)** : absente des maquettes, conservée dans le domaine ; son bouton est dans Services.
5. **Taille du texte et des cibles** : `CLAUDE.md` (≥ 16 sp, ≥ 56 dp) contre design (13–14 sp, 48 dp).
6. **Modèle des catégories** : le design propose Courses / Santé / Factures / Transport / Maison, sans couleur ; la base contient 10 catégories avec emoji et couleur. Migration à prévoir au lot 3.
7. **Traductions russes** écrites par l'assistant : à relire par un locuteur.
8. **Scan de ticket** : parcours non conçu.
9. **Confirmation de suppression non glissable pendant l'action** : « à confirmer » dans les maquettes ; choix prudent (non fermable).
