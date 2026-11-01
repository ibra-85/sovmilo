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

### Lot 4.1 : finitions de Courses

**Sursaut à l'ouverture de « Ajouter un article »** — cause : le champ avait `autoFocus`, donc le focus était demandé au montage du panneau, PENDANT son animation d'entrée (280 ms). Sur Android le clavier arrive à un moment qui varie ; quand il arrivait en cours d'entrée, deux choses bougeaient d'un coup : le panneau se « détachait » et remontait au-dessus du clavier, et la zone défilante, dont la hauteur maximale dépendait de la hauteur du clavier, se raccourcissait, ce qui changeait la hauteur du panneau et donc sa position de départ.
Correction, en deux parties :
1. **Séquence explicite** : `BottomSheet` a une propriété facultative `onPresented`, appelée une seule fois quand l'entrée est terminée (réaction Reanimated sur la progression ≥ 0,995). Les panneaux de Courses y donnent le focus au champ : le clavier arrive toujours sur un panneau immobile, et le panneau ne fait que remonter d'un seul mouvement (ressort `sheetResize`). Pas de `setTimeout`. Les autres panneaux ne changent pas (propriété optionnelle).
2. **Hauteur stable** : la place du clavier est réservée dès l'ouverture (dernière hauteur connue via `getLastKeyboardHeight()`, sinon 40 % de l'écran), donc la hauteur du panneau ne varie pas quand le clavier apparaît ou se ferme. La ligne « « X » ajouté » a sa place réservée dans le mode ajout (elle n'agrandit plus le panneau).
Limite : à la toute première ouverture après le lancement, la réserve est une estimation (la vraie hauteur du clavier n'est pas encore connue) ; la hauteur du panneau est la même ensuite. Le clavier met ~280 ms de plus à apparaître qu'avant (il attend la fin de l'entrée).

**Liste entièrement cochée** — trois états distincts : liste jamais remplie → grand état vide avec invitation ; articles restants → « À acheter » puis « Déjà pris (n) » ; tout coché → une seule ligne compacte (pastille de validation + « Tous les articles sont pris ! », fondu 160 ms) à la place de la ligne d'état, puis directement « Déjà pris (n) ». Plus de grande zone vide ; l'ancien texte d'aide (`allDoneText`) est supprimé. Décocher un article fait revenir « À acheter ».

## 5 septies. Lot 5 : module Factures et échéances

Écrans : Services → Factures (`/bills`), détail (`/bills/[id]`), formulaire (`/bill-form`, modal), panneau « Marquer comme payée ». Code : `src/features/bills/` (dépôt `repository.ts`, hooks `use-bills.ts`, textes `format.ts`, écrans), calculs purs dans `src/domain/bills.ts`. Migration `0003` : ajout seul (tables `bills` et `bill_occurrences`), aucune table existante modifiée. Pas de synchronisation dans ce lot.

**Données** : `bills` = la définition (nom, montant prévu optionnel, récurrence none / monthly / yearly, date d'ancrage, `stopped_on`, note). `bill_occurrences` = une ligne par échéance (`due_on`, montant prévu figé, `paid_on`, `paid_amount_cents`). Contraintes SQLite : montants NULL ou > 0, un montant payé exige une date de paiement, `(bill_id, due_on)` unique (aucun doublon possible). Suppression logique.

**Récurrence** (testée) :
1. Le jour est TOUJOURS recalculé depuis la date d'ancrage : 31 janv. → 28 févr. → 31 mars ; annuel 29 févr. → 28 févr. les années non bissextiles, 29 févr. les bissextiles.
2. Les échéances sont générées jusqu'à la fin du 6e mois après aujourd'hui (`GENERATION_HORIZON_MONTHS` = `CONSULTABLE_MONTHS_AHEAD`, voir Lot 5.1 ; c'était 3 au lot 5), avec toujours au moins une échéance à venir. La récurrence elle-même n'a pas de fin (voir Lot 5.2). Génération idempotente, bornée (`MAX_PLANNED_DATES`), uniquement en dates civiles `YYYY-MM-DD` (aucun fuseau, aucun changement d'heure).
3. Une facture oubliée reste visible « en retard » ; chaque échéance se paie indépendamment.
4. Modifier la série (montant, date, récurrence) ne touche QUE les échéances non payées ; un paiement passé n'est jamais réécrit. Arrêter la récurrence conserve l'historique (supprime les échéances futures non payées).

**Statuts** : en retard = non payée ET échéance avant aujourd'hui (le jour même = « à payer aujourd'hui »). « Bientôt » = dans les `SOON_WINDOW_DAYS` = 7 jours (valeur de présentation, centralisée). Le statut s'écrit toujours en texte (jamais la couleur seule).

**Totaux** : « Reste à payer » = échéances non payées de la période affichée ; les retards des périodes précédentes sont annoncés à part, sans double comptage. Montant inconnu : jamais compté 0 €, le total est signalé « partiel » avec le nombre de montants à renseigner. Entiers en centimes partout ; le montant payé (réel) peut différer du prévu et reste distinct.

**Séparation financière** : marquer payée ne crée AUCUNE opération et ne touche ni budgets ni solde manuel (test : `transactions`, `budgets`, `account_snapshots` identiques avant / après). Aucun lien automatique Factures ↔ Opérations.

**Choix d'interface** : lignes compactes avec un bouton rond de paiement de 56 dp ; panneau de paiement (date par défaut aujourd'hui, montant prévu proposé, modifiable ou vide) ; paiement annulable (toast « Annuler », 6 s) ; section « Payées » repliable ; en retard = icône d'alerte + texte, sans grande carte rouge ; menu contextuel avec MorphingPopover (modifier / arrêter la récurrence / supprimer).

**Décisions ouvertes** :
1. Première échéance au plus 366 jours dans le passé (borne de sécurité).
2. Pas d'état « archivé » séparé : arrêter la récurrence en tient lieu ; on ne peut pas la reprendre.
3. Modifier la série reconstruit le calendrier non payé à partir de la nouvelle date.
4. Renommer une facture renomme aussi l'historique de ses paiements.
5. Une échéance payée est classée dans le mois de son échéance, pas de son paiement.
6. La section « En retard » est globale (indépendante du mois affiché).
7. Pas de modification ni de saut d'une seule échéance.
8. Supprimer une facture est définitif après confirmation (pas d'annulation).
9. Paiement anticipé autorisé ; date de paiement future refusée.
10. Aucune notification ni rappel (hors périmètre du lot).

**Couvert automatiquement** (Jest, vraie base SQLite) : les quatre parcours, mois à 28 / 29 / 30 / 31 jours, années bissextiles, décembre → janvier, fuseaux et changements d'heure, statuts, totaux sans double comptage, montants inconnus, très grands montants, contraintes, idempotence, redémarrage, atomicité, migration sur base existante, séparation financière, parité et pluriels FR / RU.
**À vérifier sur téléphone** : rendu, clavier, retour Android, texte agrandi, mouvement réduit, long texte russe.

### Lot 5.1 : mois futurs de Factures et menus déroulants

**Mois futurs sans échéances** — cause : le sélecteur proposait 6 mois à venir (jusqu'à mai 2027 en novembre 2026) mais la génération s'arrêtait à 3 mois (février 2027). Les lignes n'existaient pas, l'écran n'avait rien à afficher (la requête, elle, ne filtre pas par date).
Correction : UNE constante `CONSULTABLE_MONTHS_AHEAD = 6` (`src/domain/bills.ts`) commande à la fois le sélecteur et l'horizon de génération (`GENERATION_HORIZON_MONTHS`), donc un mois proposé est toujours alimenté. En plus, `ensureOccurrences(today, month)` s'exécute quand on change de mois (le plafond de 60 mois de ce lot a été remplacé au Lot 5.2 : seul le mois consulté est ajouté, à n'importe quelle distance). Toujours idempotent (index unique, lignes payées jamais touchées). Les règles métier ne changent pas.

**Menus déroulants** (`MorphingPopover`, inchangé dans son principe : une surface, animations interruptibles, fermeture au toucher extérieur / Retour) :
1. **Hauteur maximale** : un menu ne dépasse jamais la moitié de la zone utilisable (`menuMaxHeight`) ; au-delà il défile à l'intérieur et s'ouvre sur le choix actuel (`scrollOffsetToReveal`) tant qu'on n'a pas fait défiler soi-même. Les menus d'actions (3 lignes) ne sont pas concernés.
2. **Largeur** : calculée d'après le plus long libellé (`estimateMenuWidth`, estimation volontairement généreuse, jamais moins de 232 dp, bornée par l'écran). Cause du retour à la ligne de « Arrêter la récurrence » : 160 dp utiles pour ~195 dp de texte. Si le texte est très agrandi, le libellé peut quand même passer sur deux lignes : la hauteur mesurée s'adapte.
3. **Lignes** : icône, libellé et coche sont centrés sur la hauteur de la ligne, marges haute et basse égales. Avant, l'icône était alignée sur la première ligne : un libellé sur deux lignes laissait un vide sous l'icône et le filet semblait trop bas. Plus de hauteur de ligne estimée.
4. **Libellés** : dans le menu d'une facture, « Modifier » et « Supprimer » (le contexte est la facture) ; les noms lus par TalkBack restent explicites (« Supprimer la facture Internet »).
Les dimensions du menu sont dans une seule table (`MENU_METRICS`) utilisée pour le dessin et pour le calcul de la largeur.

**Limites** : la largeur est une estimation (le texte n'est pas mesurable avant d'être dessiné) ; les autres menus de l'application s'adaptent aussi à leurs libellés mais gardent leurs textes actuels ; le rendu réel est à vérifier sur téléphone.

### Lot 5.2 : récurrences sans date de fin, langue automatique

**Récurrence, horizon et fenêtre : trois notions distinctes.**
- **Règle de récurrence** (table `bills`) : `anchor_date`, `recurrence` (`none` / `monthly` / `yearly`) et `stopped_on`. Il n'existe AUCUNE date de fin ni durée : la série vit tant que `stopped_on` est vide, et le calendrier se calcule pour n'importe quelle date future (`dueDateAt`, `dueDateInMonth`, calcul direct, sans boucle). Le jour d'origine est toujours celui de l'ancre (le 31 se replie en février puis revient, le 29 février annuel retrouve le 29 les années bissextiles).
- **Occurrences enregistrées** (table `bill_occurrences`) : une ligne par `due_on`, créée seulement quand elle est utile, jamais deux fois (index unique `(bill_id, due_on)`), jamais réécrite si elle est payée.
- **Fenêtre consultable** : les 6 mois du sélecteur (`CONSULTABLE_MONTHS_AHEAD`), une présentation sans effet sur la règle.

**Ce que représentait la limite de 60 mois** (Lot 5.1) : ni une fin de validité ni une limite de navigation, mais une borne de génération par requête, posée par prudence. Elle avait un défaut : elle empêchait de matérialiser un mois au-delà de 5 ans. Elle est remplacée.

**Règles de calcul à la demande** (`plannedDueDates`, fonction pure) :
1. Horizon glissant : toutes les dates de l'ancre jusqu'à la fin du 6e mois après aujourd'hui (l'historique, y compris les échéances oubliées et impayées), plus la prochaine échéance si aucune n'est à venir (série annuelle). L'horizon avance avec le temps.
2. Mois consulté (`viewedMonth`, même à 70 ans) : seule l'échéance de CE mois est ajoutée, jamais les mois d'entre-deux. Une série mensuelle ajoute au plus une ligne, une annuelle une ligne seulement si c'est son mois. Mois passé, déjà couvert ou invalide : rien.
3. Récurrence arrêtée : rien après `stopped_on`, ni dans l'horizon ni dans un mois consulté.
4. Borne de TRAVAIL d'une opération (`MAX_PLANNED_DATES` = 360, soit 30 ans de factures mensuelles) : elle ne joue que si l'ancre est démesurément ancienne (date saisie à la main). Ce sont alors les dates les PLUS RÉCENTES qui sont gardées : la fenêtre glisse avec le temps, la série ne s'arrête jamais. Avant, le plafond de 1 200 dates (100 ans) faisait caler la série ; il n'existe plus de limite de validité.

**Garanties sur l'historique** : une génération n'insère que les lignes manquantes (elle ne supprime rien, ne modifie aucune ligne payée ni aucune ligne existante). Montants prévus et payés, dates de paiement, retards impayés, échéances d'une série oubliée pendant des années, modifications explicites et règles d'arrêt sont inchangés. Les paiements ne créent aucune opération financière.

**Limites** : le sélecteur reste à 6 mois à venir (le filtre avancé viendra plus tard) ; une série consultée à un mois lointain laisse un « trou » dans la base entre l'horizon et ce mois, voulu (les mois intermédiaires sont recalculés si on les ouvre) ; un recalage de calendrier supprime logiquement les lignes non payées, y compris ces mois lointains, qui sont recréés à la demande.

**Langue : Automatique, Français ou Русский** (`src/i18n/`, i18next inchangé : aucune bibliothèque ajoutée, `expo-localization` était déjà installé).
- **Deux notions** : la *préférence* (`auto` / `fr` / `ru`), mémorisée sous `sovmilo.languagePreference`, et la *langue effective* (`fr` / `ru`), déduite et jamais mémorisée. « Automatique » et « Français choisi » restent donc distincts même quand le téléphone est en français.
- **Résolution** (`resolve.ts`, pure) : en Automatique, on lit UNIQUEMENT la première langue du téléphone (`getLocales()[0]`) ; `fr-*` → français, `ru-*` → russe, toute autre langue, absente ou illisible → français. Une langue secondaire n'est jamais retenue (téléphone « anglais puis russe » : français). Un choix manuel l'emporte toujours.
- **Retour au premier plan** : Android peut changer de langue pendant que l'application est en arrière-plan. Un seul écouteur `AppState` (`refreshOnForeground`) relit la langue quand l'état redevient `active`, en Automatique seulement ; rien n'est notifié, écrit ni réappliqué si la langue effective n'a pas changé. L'interface se met à jour sans redémarrage ni réinitialisation de la navigation.
- **Anciennes préférences** : avant ce lot, `sovmilo.locale` contenait `fr` ou `ru`. S'il n'y a pas de nouvelle préférence, cette valeur est reprise comme choix manuel (écrite une fois au nouveau format, ancienne clé laissée intacte) ; sinon Automatique. **Ambiguïté assumée** : l'ancien code enregistrait aussi la langue *détectée* au premier lancement, sans pouvoir la distinguer d'un vrai choix ; cette intention n'a jamais été enregistrée et n'est pas reconstituée. Stratégie non destructive : la langue actuelle est conservée, et l'utilisatrice peut repasser en Automatique dans Paramètres.
- **Repli français** : (1) langue du téléphone non prise en charge → français ; (2) clé absente en russe → texte français (`fallbackLng`). Une clé absente partout reste visible en développement (pour être corrigée) et s'affiche vide en production : jamais d'identifiant technique à l'écran. Le repli ne masque pas les oublis : en développement un avertissement liste les clés russes absentes, et le test de parité FR/RU échoue (`missingTranslations`).
- **Données** : changer de langue n'écrit que la préférence ; montants, devise (euro), dates stockées et noms saisis par l'utilisatrice (catégories, factures, listes) ne sont ni modifiés ni traduits. Dates, mois, montants et pluriels suivent la langue effective (`Intl`).
- **Paramètres** (design Precision Glass, `ChoiceGroup` comme Apparence) : Automatique (avec la langue utilisée : « Suit le téléphone · Français »), Français, Русский.
- **À vérifier sur téléphone** (non testable en Jest) : changer la langue d'Android puis revenir dans Sovmilo ; appui sur Retour/Accueil entre-temps ; texte système agrandi dans Paramètres ; TalkBack ; thème clair/sombre.

### Lot 5.2.1 : libellé de l'onglet actif absent en français

- **Cause** : pas la traduction ni le changement de langue du Lot 5.2, mais le seuil « icônes seules » de la barre (`shouldUseIconsOnly`). La barre exige que la pastille du libellé le plus long laisse 44 dp à chacun des 3 autres onglets. Sur un écran de 393 dp (barre de 267 dp), le maximum était 75 dp de libellé ; « Opérations » mesure 75 dp en Inter semi-gras 14 (76 mesuré avec la marge de 1 dp) contre 72 pour « Операции ». Le français dépassait donc le seuil de 1 dp et TOUS les libellés disparaissaient, le russe passait. Mesures prises dans le fichier de police : Accueil 51, Opérations 75, Budgets 56, Services 59 ; Главная 57, Операции 70, Бюджеты 68, Сервисы 63.
- **Correction** (`tab-layout.ts`, `floating-tab-bar.tsx`) : `fitPillPadding` réduit la marge interne de la pastille (14 dp du design, jamais moins de 8 dp) juste assez pour que le libellé le plus long tienne. Sur 393 dp la marge passe à 13 dp en français ; le russe garde 14 dp. Design, animations, onglets inactifs et passage en icônes seules à 130 % de texte sont inchangés.
- **Limite** : sur un écran étroit (360 dp, barre de 234 dp) « Opérations » ne tient pas même à 8 dp ; la barre reste alors en icônes seules, comme prévu pour les petits écrans.
- **Test de non-régression** : `tab-layout.test.ts` (mesures réelles FR / RU, cause reproduite avec la marge de 14 dp, géométrie exacte après correction).

### Avertissement Reanimated « Dependencies should only be used on the web »

- **Cause** : notre propre `useAnimatedReaction(...)` dans `src/components/ui/bottom-sheet.tsx` (ajouté au lot 4.1 pour `onPresented`) recevait un tableau de dépendances. Sur natif, Reanimated ignore ces dépendances et le signale en développement.
- **Correction** : appel sans tableau de dépendances (le compilateur worklets suit les valeurs capturées). Aucun `LogBox.ignoreLogs`, aucune mise à jour de bibliothèque, `node_modules` intact.
- **Garde-fou** : `src/hooks/reanimated-deps.test.ts` analyse le code source et échoue si un `useAnimatedStyle`, `useDerivedValue`, `useAnimatedReaction`, `useAnimatedProps` ou `useAnimatedScrollHandler` reçoit un tableau de dépendances. Les hooks React ordinaires (`useEffect`, `useMemo`, `useCallback`) gardent les leurs.
- **Non vérifié sur appareil** : la disparition du message à l'exécution n'a pas été constatée (l'application n'est pas lancée dans ce lot).

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
3. **Contenu de l'onglet Services** : Solde manuel, Épargne, Catégories, Paramètres + Courses (lot 4) et Factures (lot 5) actives, Statistiques « Bientôt ».
10. **Catégorie utilisée** : réaffectation des opérations, budgets retirés — décidé et confirmé le 31/10/2026.
4. **Épargne (virement)** : absente des maquettes, conservée dans le domaine ; son bouton est dans Services.
5. **Taille du texte et des cibles** : `CLAUDE.md` (≥ 16 sp, ≥ 56 dp) contre design (13–14 sp, 48 dp).
6. **Modèle des catégories** : le design propose Courses / Santé / Factures / Transport / Maison, sans couleur ; la base contient 10 catégories avec emoji et couleur. Migration à prévoir au lot 3.
7. **Traductions russes** écrites par l'assistant : à relire par un locuteur.
8. **Scan de ticket** : parcours non conçu.
9. **Confirmation de suppression non glissable pendant l'action** : « à confirmer » dans les maquettes ; choix prudent (non fermable).
