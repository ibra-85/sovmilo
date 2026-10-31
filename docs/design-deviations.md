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
- Les anciens écrans d'onglets (Accueil, Historique, Budget, Plus) gardent leur habillage actuel jusqu'au lot 3 ; ils reçoivent seulement la marge basse de 132 dp pour passer au-dessus de la barre. Le pont de couleurs `src/theme/colors.ts` et les lignes `features/transactions/transaction-row.tsx` disparaîtront à ce moment.

## 6. Couleurs provisoires

Les couleurs d'alerte (`danger*`) ne sont pas fixées par les maquettes : provisoires. L'accent citron clair `#DDF35D` (clair) est un jeton de réserve.

## 7. Décisions ouvertes (à trancher par le propriétaire)

1. **Report des limites de budget d'un mois sur l'autre** : implémenté à l'étape 2a (les limites se reportent), **jamais confirmé**. Non modifié.
2. **Seuil « presque atteint »** : le domaine utilise 80 % (étape 2a) ; le design propose 75 % (fictif).
3. **Contenu de l'onglet Services**.
4. **Épargne (virement)** : absente des maquettes, conservée dans le domaine et l'ancien écran d'accueil.
5. **Taille du texte et des cibles** : `CLAUDE.md` (≥ 16 sp, ≥ 56 dp) contre design (13–14 sp, 48 dp).
6. **Modèle des catégories** : le design propose Courses / Santé / Factures / Transport / Maison, sans couleur ; la base contient 10 catégories avec emoji et couleur. Migration à prévoir au lot 3.
7. **Traductions russes** écrites par l'assistant : à relire par un locuteur.
8. **Scan de ticket** : parcours non conçu.
9. **Confirmation de suppression non glissable pendant l'action** : « à confirmer » dans les maquettes ; choix prudent (non fermable).
