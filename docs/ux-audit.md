# Audit UX de Sovmilo (Lot 6A)

Audit de l'application telle qu'elle est au Lot 6 (branche `claude/awesome-albattani-dncieu`), réalisé en lisant le code et les documents du dossier privé `design/` (jamais publié). Il sert de base aux décisions du Lot 6B (Épargne) et 6C (interactions), et de feuille de route pour une revue UX globale. **Rien n'a été refait dans les anciens écrans** : les propositions sont classées, pas appliquées.

Légende des classements : **V** = valeur pour l'utilisatrice (haute / moyenne / basse), **R** = risque de régression, **C** = coût de mise en œuvre.

---

## 1. Inventaire

### 1.1 Composants partagés (`src/components/ui/`)

| Famille | Composants | Remarques |
| --- | --- | --- |
| Structure | `AppScreen`, `ScreenHeader`, `Surface`, `FieldGroup` (+ `FormRow`, `InfoRow`, `ServiceRow`), `Divider`, `SectionHeader`, `Stack` / `Row` | `ScreenHeader` secondaire = retour 44 dp + titre 20 sp + `trailing` (souvent le « ⋯ »). |
| Saisie | `TextField`, `AmountInput`, `SearchField`, `SegmentedControl`, `ChoiceGroup`, `DateRow` (dans `features/transactions`) | `DateRow` n'est pas dans `ui/` alors qu'il est utilisé par Factures et Épargne. |
| Actions | `Button` (primary / secondary / destructive, compact), `IconButton`, `Pressable` (enfoncement 1 dp, focus visible) | Une seule base tactile : bon point. |
| Superpositions | `BottomSheet`, `ConfirmDialog`, `MorphingPopover` (+ `PopoverHostProvider`, `usePopoverTrigger`), `PopoverMenu`, `ToastProvider` / `useToast` | Les trois reposent sur des mécanismes différents (Modal, hôte de popover, vue flottante). |
| Affichage | `AmountText`, `ProgressBar`, `BudgetRow`, `TransactionRow`, `CategoryIcon`, `CategoryTile`, `EmptyState`, `Skeleton`, `Spinner`, `WeeklyChart`, `PeriodSelector` | `WeeklyChart` est le seul graphique ; il est spécialisé (7 barres). |
| Motion | `useMotion` (jetons `timing` / `spring`, animations réduites), `usePresence` | Les durées viennent de `src/theme/motion.ts` ; aucune durée en dur dans les écrans. |

### 1.2 Écrans et modules

Navigation V5.2 : barre flottante **Accueil · Opérations · Budgets · Services** + bouton « + ». Écrans empilés par-dessus : Ajouter, Détail / Modifier une opération, Budgets (créer, détail, plafond), Solde réel, Catégories, Paramètres, Courses (listes, liste), Factures (liste, détail, formulaire) et, depuis ce lot, **Épargne** (objectifs, détail, archives).

Modules métier : `transactions`, `budgets`, `categories`, `balance`, `history`, `shopping`, `bills`, `savings`, `settings`. Règles de calcul pures dans `src/domain/` (testées) ; accès aux données dans `repository.ts` de chaque module (SQLite, transactions Drizzle) ; lectures en direct par `useLiveQuery`.

### 1.3 Gestes aujourd'hui

- Un seul usage de Gesture Handler : **glisser la poignée du BottomSheet vers le bas** (fermeture si > 30 % de la hauteur ou geste rapide ; résistance vers le haut).
- Retour Android : `onRequestClose` des Modal (panneaux), retour natif de la pile (`native-stack`) pour les écrans. Le geste de retour prédictif est désactivé (`predictiveBackGestureEnabled: false`).
- Aucun balayage de ligne, aucun glisser-déposer, aucun tirer-pour-actualiser avant le Lot 6.
- Seule liste virtualisée : l'historique des opérations (`history-screen`). Les autres listes sont des `ScrollView` + `map` (suffisant pour des dizaines de lignes).

---

## 2. Parcours principaux (nombre de touchers)

| Parcours | Touchers | Jugement |
| --- | --- | --- |
| Ajouter une dépense (priorité absolue) | « + » → montant → catégorie → ✓ = **3 à 4** | Bon. Date du jour et carte par défaut. |
| Consulter le reste à dépenser | 0 (Accueil) | Excellent. |
| Marquer une facture payée | ligne → coche → ✓ = **2** (depuis la liste) | Bon. |
| Cocher un article de courses | **1** | Excellent. |
| Corriger un solde réel | Services → Solde → saisie → ✓ = 4 | Correct (rare). |
| **Épargne : ajouter de l'argent** | Services → Épargne → « + » de la ligne → montant → Ajouter = **4** | Nouveau. 3 si l'on est déjà dans Épargne. |
| Épargne : créer un objectif | Épargne → « Nouvel objectif » → nom + montant → Créer = **3** | Nouveau. |
| Changer la langue | Services → Paramètres → langue = 3 | Correct. |

## 3. Incohérences relevées

1. **Trois façons de confirmer une action destructive** : `ConfirmDialog` (panneau), suppression directe avec « Annuler » dans la notification, confirmation inline. Les deux premières sont justifiées ; la troisième n'est utilisée que dans le panneau de mouvement d'Épargne (pour éviter d'empiler deux Modal).
2. **« Annuler » a deux sens** : « annuler l'action » (fermer un panneau) et « annuler ce qui vient d'être fait » (notification). Les libellés d'Épargne distinguent « Annuler ce versement », « Garder » et « Annuler » (notification) ; à généraliser.
3. **Retour en haut à gauche** : libellés de retour tantôt génériques (`common.back`), tantôt contextuels (`bills.back`). Les deux sont corrects ; l'accessibilité gagne au contextuel.
4. **Emplacement des actions principales** : bouton pleine largeur en bas (Factures, Courses, Épargne) mais bouton dans l'en-tête pour d'autres écrans anciens. À harmoniser lors de la revue globale.
5. **Barre de progression** : Budgets utilise `over` (rouge au dépassement) ; Épargne utilise `complete` (couleur « réussite »). Deux booléens indépendants dans `ProgressBar` : acceptable, mais à regrouper en une seule prop `tone` si un troisième cas apparaît.
6. **Services → Épargne** ouvrait directement l'écran « Ajouter un virement ». Désormais l'écran Épargne ; le virement reste accessible (lien « Noter un virement dans les opérations »). Un utilisateur habitué doit faire un toucher de plus : accepté, car l'épargne déclarative et le virement sont deux notions distinctes.
7. **Date** : `DateRow` vit dans `features/transactions` mais sert à trois modules.

## 4. Interactions simplifiables

- **Versement rapide depuis la liste** (fait) : le bouton rond « + » de chaque objectif évite d'ouvrir le détail.
- **Premier versement à la création** : non ajouté. La création reste à deux champs ; un champ « montant déjà épargné » serait un second concept (il n'apparaîtrait pas dans l'historique). Le premier versement se fait en un toucher de plus.
- **Date des mouvements** : proposée à aujourd'hui, modifiable ; jamais dans le futur (on déclare ce qui est fait).
- **Clavier** : le panneau de mouvement donne le focus au montant une fois posé (comportement du Lot 4.1 conservé).

---

## 5. Gestes : matrice par écran

Règle commune : **un geste n'est jamais le seul moyen** d'effectuer une action importante. Priorité de fermeture : clavier ou calque actif → panneau / popover → écran, **jamais deux actions pour un même geste**.

| Geste | Où utile | Où nuisible | Interaction avec navigation / défilement | Android | Alternative accessible | Risque de faux déclenchement |
| --- | --- | --- | --- | --- | --- | --- |
| **Glisser pour fermer un panneau** (poignée) | Tous les BottomSheet (déjà en place) | Pendant une action en cours (`dismissible=false`) | Limité à la poignée : champs et grilles gardent leurs gestes | Retour = `onRequestClose` | Voile, bouton Retour, bouton de fermeture | Faible (poignée de 28 dp) |
| **Glisser-déposer pour réordonner** | **Épargne** (mode « Réorganiser ») ; plus tard listes de Courses | Listes triées automatiquement (Opérations, Factures) | Depuis la poignée uniquement, après appui long de 220 ms : le défilement n'est pas intercepté | Pas de conflit avec le geste système (zone à 52 dp du bord gauche) | **Flèches monter / descendre** par ligne, annonces TalkBack de la position | Faible (poignée dédiée + appui long) |
| **Appui long → menu / aperçu** | Rien de clairement meilleur qu'un bouton | Conflit direct avec le glisser-déposer et avec le défilement | Se déclenche pendant un défilement lent | Menu contextuel système possible | Bouton « ⋯ » visible | Moyen → **non retenu** |
| **Balayer une ligne** (actions) | Archiver une facture / un article de courses éventuellement | **Mouvements d'Épargne : interdit** (pas de suppression par un balayage) ; lignes cliquables denses | Conflit avec le retour par balayage de bord et avec le défilement horizontal des carrousels | Retour système = bord gauche | Bouton explicite, menu « ⋯ » | Élevé → **reporté**, voir 7 |
| **Tirer pour actualiser** | Aucun écran : les données sont locales et **en direct** (`useLiveQuery`), il n'y a rien à rafraîchir | Tous (spinner mensonger) | Entre en concurrence avec le glisser pour fermer | — | — | **Non retenu** (documenté, pas de faux spinner) |
| **Balayage de bord (retour)** | Tous les écrans empilés | — | Géré par la pile native, **non intercepté** | Retour système classique ; prédictif désactivé | Bouton retour de l'en-tête | Nul (natif) |
| **Appui long sur la poignée seule** | Réorganisation | — | — | — | Flèches | Faible |

Les cas particuliers du glisser-déposer d'Épargne : relâcher à la place d'origine n'écrit rien ; un geste interrompu par le système ramène la liste à son état de départ ; l'ordre est enregistré **une seule fois au relâchement** (jamais par image) ; un versement ne réordonne jamais la liste.

## 6. Composants à partager ou à améliorer

| Élément | Constat | Proposition | V / R / C |
| --- | --- | --- | --- |
| `DateRow` | Utilisé par trois modules, hors `ui/`. Date facultative et bornes ajoutées au Lot 6 | Le déplacer dans `ui/` | moyenne / faible / faible |
| Feuille « montant + date + note » | Paiement de facture et mouvement d'Épargne ont la même structure (zone bornée par le clavier, verrou anti-double-toucher, identifiant choisi à l'ouverture) | Extraire un `AmountSheet` générique si un troisième cas apparaît (Objectifs, Budgets) | moyenne / moyen / moyen |
| `ProgressBar` | `over` et `complete` séparés | Prop `tone` unique à la prochaine évolution | basse / faible / faible |
| `GoalRow` / `BillRow` | Même gabarit (pastille, titre, sous-ligne, action ronde à droite) | Composant `ActionRow` commun | moyenne / moyen / moyen |
| Confirmation | `ConfirmDialog` + note de rappel dupliquée (`ConfirmNote`) dans Factures et Épargne | Un `ConfirmNote` commun | basse / faible / faible |
| Liste réorganisable | Implémentation locale (`reorder-list.tsx`) | À promouvoir dans `ui/` quand Courses en aura besoin | moyenne / faible / moyen |
| Pure logique de glissement | Extraite : `sheet-dismiss.ts`, `dragTargetIndex`, `shiftSlots` (testées) | Garder ce principe pour tout futur geste | haute / nul / nul |

## 7. Performance : points d'attention

- **Épargne** : le montant de chaque objectif vient d'**une seule requête agrégée** (`GROUP BY`), pas de l'historique ; l'historique d'un objectif est une `FlatList` (virtualisée) ; les lignes sont mémoïsées sur leurs champs affichés. Aucun calcul monétaire par image : le glissement ne manipule que des valeurs animées.
- Les écrans anciens (Courses, Factures, Budgets) utilisent `ScrollView` + `map` : sans problème pour des dizaines de lignes ; à surveiller si une liste dépasse ~200 éléments.
- `useLiveQuery` relance la requête à chaque écriture de la table suivie : acceptable (base locale), mais éviter d'ouvrir plusieurs abonnements identiques sur le même écran.
- Aucun problème mesuré sur téléphone dans ce lot (l'application n'a pas été lancée : consigne). À vérifier sur le Redmi Note 14 Pro+ : fluidité du glissement avec ~30 objectifs.

## 8. Améliorations prioritaires (hors Épargne)

| # | Amélioration | V | R | C |
| --- | --- | --- | --- | --- |
| 1 | Harmoniser l'emplacement de l'action principale (bouton bas d'écran) sur les écrans anciens | haute | moyen | moyen |
| 2 | Déplacer `DateRow` dans `ui/` | moyenne | faible | faible |
| 3 | Réorganisation des listes de Courses avec `ReorderList` | moyenne | faible | moyen |
| 4 | Libellés de retour contextuels partout | moyenne | faible | faible |
| 5 | `AmountSheet` générique | moyenne | moyen | moyen |
| 6 | Défilement automatique pendant le glissement d'une longue liste | basse | moyen | moyen |

## 9. Réservé à une revue UX globale

Ces points touchent plusieurs écrans anciens ou la navigation V5.2 ; ils ne sont pas traités ici :

- Emplacement homogène des actions principales et secondaires.
- Fusion éventuelle des écrans « Solde réel » et « Épargne » dans un même parcours « Mon argent ».
- Densité des lignes de l'historique à grande taille de texte.
- Écran d'aide HyperOS (démarrage automatique, batterie) avec les notifications.
- Politique d'animation des changements de liste (apparition / disparition d'une ligne).

---

## 10. Statistiques : proposition de graphiques (module futur)

Principes : lisibilité d'abord, aucune bibliothèque de graphiques lourde, tout calculé dans `src/domain/` (pur, testé) puis dessiné avec des `View` (comme `WeeklyChart`) ou `react-native-svg` si une courbe est indispensable. Couleurs neutres du thème (le remplissage « neutre » de `ProgressBar`), jamais une couleur par catégorie comme seule information ; chaque graphique a un équivalent texte lu par TalkBack.

1. **Dépenses par catégorie du mois** : barres horizontales classées (montant + part), les 6 plus grosses puis « autres ». Plus lisible qu'un camembert pour une utilisatrice peu habituée.
2. **Évolution sur 6 mois** : barres verticales (dépenses) avec ligne des revenus ; tendance en une phrase (« 8 % de moins qu'en septembre »).
3. **Budget vs réel** : réutiliser `BudgetRow` (déjà une barre) plutôt qu'un nouveau graphique.
4. **Épargne** : barre de progression par objectif (déjà fait) ; un graphique circulaire n'ajoute aucune information et n'est donc pas retenu. À terme : courbe cumulée des versements d'un objectif (données déjà disponibles via `runningBalances`).
5. États : graphique vide (« Pas encore de données ce mois-ci »), un seul point, montants extrêmes (réutiliser les règles responsive de la section « 5 quinquies » de `design-deviations.md`).

## 11. Prototype comparatif du MorphingPopover (idée documentée, non implémentée)

Le MorphingPopover V3 (le panneau part de son bouton déclencheur et s'y replie) est validé : **il n'est pas réécrit**. Une variante pourrait être comparée sur appareil avant toute décision :

- **Variante « fondu + léger déplacement »** : le panneau apparaît en fondu (opacité 0 → 1, 160 ms) avec 8 dp de montée depuis sa position finale, sans agrandissement depuis le bouton. Même hôte, mêmes éléments, mêmes jetons (`menuIn`, `menuTranslateY`).
- **Pourquoi la tester** : sur un appareil modeste, le morphing demande de mesurer l'ancre et d'animer le rayon, la taille et la position ; la variante n'anime que l'opacité et un décalage. Elle pourrait aussi mieux convenir aux utilisateurs qui réduisent les animations (déjà couvert : fondu de 100 ms au plus).
- **Protocole** : ajouter un réglage développeur éphémère `popoverStyle = 'morph' | 'fade'`, comparer à l'œil et à la fluidité (30 ouvertures / fermetures) sur le Redmi Note 14 Pro+, puis supprimer le réglage. Aucune décision avant ces mesures.

---

## 12. Décisions du Lot 6C (interactions)

| Interaction | Décision | Où / pourquoi |
| --- | --- | --- |
| Glisser-déposer pour réordonner | **Implémenté** et testable | Épargne, mode « Réorganiser » (icône ≡ dans l'en-tête). Poignée + appui long, flèches, annonces TalkBack, ordre enregistré au relâchement. |
| Glisser pour fermer un panneau | **Déjà en place**, non remplacé ; règles extraites dans `sheet-dismiss.ts` et testées | Tous les panneaux. |
| Retour (système / bouton) | **Natif**, non intercepté | Pile Expo Router ; Modal pour les panneaux. |
| Tirer pour actualiser | **Non retenu** | Données locales et en direct ; un spinner serait faux. |
| Appui long → aperçu | **Non retenu** | Conflit avec le glisser-déposer ; remplacé par le bouton rond « + » de chaque objectif (versement en deux touchers). |
| Balayage de ligne (actions) | **Reporté** | Jamais pour les mouvements d'Épargne. Cible possible : archiver une facture payée ou retirer un article de Courses, **avec** bouton équivalent et test de conflit avec le retour par le bord. |
| Sélecteur de date | **Amélioré seulement pour Épargne** | `DateRow` : date facultative, bornes (pas de date passée pour la cible, pas de futur pour un mouvement), localisé par le système. Pas de calendrier maison. |
| Graphiques | **Barre de progression seulement** | Voir section 10 pour la suite. |

Intégration prévue dans les autres modules : **Courses** (réorganiser les listes avec `ReorderList`), **Factures** (balayage « marquer payée » avec le bouton existant), **Budgets** (aucun geste ajouté), **Opérations** (aucun : liste triée par date).

## 13. Révisions du Lot 6.1

| Interaction | Décision révisée | Où / pourquoi |
| --- | --- | --- |
| Panneau : glisser la poignée | **Deux états** pour « Nouvel objectif » seulement (compact ↔ déployé) ; les autres panneaux inchangés | Fermeture jamais déclenchée depuis le déployé. Voir `design-deviations.md` § 5 nonies. |
| Appui long sur une carte d'objectif | **Implémenté** : menu Modifier / Réorganiser / Archiver | Le conflit avec le glisser-déposer n'existe plus : le glisser ne démarre que depuis la poignée du mode Réorganiser. Jamais le seul accès (icône ≡, détail). |
| Réorganiser | **Session provisoire** : Terminé / Annuler / Retour confirmé | L'ordre n'est plus écrit à chaque déplacement. |
| Tirer pour actualiser | **Retenu pour Factures seulement** (révise le § 12) ; **étendu aux écrans de données principaux au Lot 6.2B** (`design-deviations.md` § 5 decies) | Date du jour et échéances générées : seul cas où un tirage relit réellement quelque chose. Autres écrans : déjà en direct. |
| Lien « Noter un virement » | **Retiré** | Ambigu, sans lien avec les objectifs. |

## 14. Comparaison avec trois composants d'Essavio (Lot 6.2C, révision `9e00abf`)

Source : dépôt `ibra-85/essavio`, accessible, lu en entier : `mobile/src/components/design-system/sheet.tsx`, `context-menu.tsx`, `select-field.tsx`, plus `lib/sheet-motion.ts`. Rien n'est supposé. Principe : une architecture différente n'est pas meilleure par principe ; le BottomSheet de Sovmilo vient d'être validé sur téléphone et ne change pas dans cette passe.

### 14.1 Sheet

| Point | Essavio `Sheet` | Sovmilo `BottomSheet` |
| --- | --- | --- |
| Fenêtre | `Modal` + `GestureHandlerRootView` | **Identique** (`Modal`, `statusBarTranslucent`, `navigationBarTranslucent`) |
| Hauteur | Celle du contenu, `maxHeight` 90 %, `ScrollView` interne | Naturelle pour les panneaux simples ; **deux états** compact / déployé calculés depuis la fenêtre, les marges, le clavier et le contenu MESURÉ (`sheet-snap.ts`), pied fixe |
| Mouvement | Valeurs partagées Reanimated, aucun rendu React pendant le glissement ; fermeture qui garde la vitesse du doigt (`sheetCloseDuration`) ; voile dérivé de la position | Idem (ressorts, voile estompé au glissement) ; fermeture au seuil de 30 % de la hauteur ou 900 px/s |
| Geste | Glisser depuis la poignée **et le titre** (zone plus grande), `activeOffsetY(8)`, `failOffsetX` | Poignée seule (28 dp), sans seuils d'activation |
| Clavier | `KeyboardAvoidingView` sur iOS seulement ; sur Android, rien : le panneau n'est pas garanti au-dessus du clavier | Panneau détaché au-dessus du clavier, champ et bouton toujours visibles |
| Accessibilité | **Poignée accessible** : rôle bouton, « Fermer {titre} », action `activate` ; `onAccessibilityEscape` (iOS) | Poignée masquée à TalkBack ; le voile est un bouton nommé d'après le titre ; Retour Android → `onRequestClose` |
| Animations réduites | Durée 0 | Ressorts à durée 0, fondu de 100 ms au plus (`useMotion`) |

- **À reprendre** (valeur démontrée, risque faible, **non intégré** car cela ne s'observe que sur appareil avec TalkBack) : rendre la poignée accessible avec l'action « Fermer {titre} » ; le voile actuel s'annonce du nom du panneau, pas de « fermer ».
- **À étudier plus tard** : zone de glissement élargie au titre (suppose un prop `title`, car le titre est aujourd'hui dans le contenu) ; fermeture à vitesse continue.
- **À ne pas reprendre** : hauteur « contenu, 90 % » (moins précise que la nôtre), absence de gestion du clavier sur Android.

### 14.2 ContextMenu

| Point | Essavio `ContextMenu` | Sovmilo `MorphingPopover` V3 |
| --- | --- | --- |
| Couche | **Un `Modal` par menu** (seconde fenêtre native) | Hôte dans la MÊME hiérarchie native (`popover-host.tsx`), sans `Modal` |
| Placement | Sous le déclencheur ; au-dessus si la hauteur mesurée ne tient pas ; largeur imposée ou adaptée ; hauteur maximale avec défilement | Idem en fonctions pures testées (`popover-layout.ts`) : côté, ancrage `end` / `center`, modes `cover` / `beside`, clavier, hauteur maximale, largeur estimée selon les libellés (russe) |
| Animation | `animationType="fade"` du Modal (pilotée par Android) | Un seul moteur interruptible : surface qui se transforme, fondu, inversion au toucher pendant la fermeture |
| Libellés | `numberOfLines={1}` : un libellé russe long est tronqué | Largeur adaptée au plus long libellé |
| Accessibilité | `menu` / `menuitem`, fond « Fermer le menu » | `menu` / `menuitem`, libellé complet par ligne, reste de l'application masqué |
| Animations réduites | Aucune gestion propre | Mode `beside`, fondu de 100 ms au plus |

- **Risques Android d'un Modal pour un menu** : création d'une fenêtre à chaque ouverture (coût, clignotement possible de la barre d'état), coordonnées qui peuvent différer de celles du déclencheur, deux Modales superposées (menu depuis un panneau) à l'ordre fragile.
- **Atout réel de la référence** : un menu en `Modal` s'affiche **au-dessus d'un panneau** (notre hôte est sous les `Modal` des panneaux). Aucun écran de Sovmilo n'ouvre aujourd'hui un menu depuis un panneau. Si le besoin apparaît, la réponse est une variante `host: 'modal'` de l'hôte, pas le remplacement du moteur.
- **Idée utile** : le rappel `onHidden` pour enchaîner « menu fermé, puis panneau ». Chez nous le menu n'est pas une fenêtre : l'enchaînement actuel (fermer, puis ouvrir le panneau) est déjà sûr.

### 14.3 SelectField

Un champ qui ouvre un `Sheet` de choix (radio), avec saisie personnalisée optionnelle. Adapté aux **longues listes** (langues, catégories, devises), pas aux petits menus d'actions. Sovmilo fait déjà : petits choix en `MorphingPopover` (sélecteur de période), listes dans un panneau (réaffectation de catégorie : `ChoiceGroup` dans un `ScrollView` borné). Rien à changer maintenant ; extraire un `SelectSheet` n'aurait de sens qu'avec un deuxième usage identique. Reprise possible : le champ personnalisé qui passe à la ligne sous le bouton quand la place manque (`flexWrap`, `flexBasis`), déjà notre pratique pour les montants.

### 14.4 Retenu, non retenu

- **Retenu dans ce lot** : aucun code copié. La lecture confirme trois choix de Sovmilo (même `Modal` + `GestureHandlerRootView`, geste sur le thread UI, placement au-dessus si la place manque) et donne deux pistes datées : poignée accessible, variante `modal` de l'hôte.
- **Non retenu** : remplacer `BottomSheet`, réécrire `MorphingPopover`, changer les menus déroulants.

### 14.5 Prototype A/B proposé : menu « fondu » (à NE PAS activer sans validation)

- **Constat** : le moteur gère déjà un chemin `reduced` (placement `beside`, surface directement à sa place, fondu seul). Le menu sobre est donc presque là.
- **Variante B « fade »** : prop `variant?: 'morph' | 'fade'` de `MorphingPopover` (défaut `morph`, V3 inchangée). En `fade` : placement `beside` ; opacité de 0 à 1 en 140 ms ; déplacement de 6 dp depuis le côté du déclencheur, jamais de mise à l'échelle ; fermeture en 100 ms ; mêmes règles d'interruption (le moteur inverse déjà à partir de la position courante) et de réouverture (`onReopen`) ; le déclencheur reste visible (pas de `cover`).
- **Mise en œuvre prudente** : variante lue depuis un réglage de développement masqué (ou `EXPO_PUBLIC_MENU_VARIANT`), jamais exposée dans les Paramètres tant que la décision n'est pas prise ; tests purs sur les étapes de mouvement de la variante et l'inversion à mi-course (la géométrie ne change pas).
- **Protocole de comparaison sur Android** : mêmes menus (appui long d'une carte d'Épargne, « ⋯ » des Opérations, sélecteur de période) ; 10 ouvertures lentes et 10 rapides (double toucher, toucher pendant la fermeture) par variante ; observer le temps avant la première image, les images perdues (moniteur de performance), les touchers manqués, la lisibilité en mode sombre et avec animations réduites. La décision revient au propriétaire.

## 15. Lot 7 : sauvegarde, restauration et mises à jour dans Paramètres

- **Constat** : aucune façon de récupérer les données si l'on change de téléphone ou réinstalle ; aucun moyen de recevoir une correction sans nouvel APK. Pour une utilisatrice peu habituée aux applications, les deux actions doivent être lisibles et sans piège.
- **Choix** : deux sections en bas de Paramètres (après Langue), chacune avec un titre, une phrase d'explication et des lignes de service de 56 dp minimum. Textes à 16 sp pour le corps ; le texte d'état est en 14 sp (légende), à vérifier en grande police.
- **Sauvegarde** : un avertissement « non chiffré » avant le choix du dossier ; une progression non fermable ; un résultat en deux temps (fichier *enregistré* et relu, ou *aucun fichier enregistré* si le sélecteur est fermé). La date affichée est celle de la dernière écriture vérifiée, jamais d'une simple création en mémoire.
- **Restauration** : choix du fichier, validation complète **avant** tout changement, aperçu chiffré (date, version, nombres lus dans le fichier), phrase de remplacement dans un encadré d'alerte, bouton rouge « Remplacer mes données » ; quatre issues distinctes (restaurée, annulée avec retour des données précédentes, incomplète, refusée).
- **Mises à jour** : l'état est toujours écrit en toutes lettres ; dans Expo Go, aucun bouton actif, seulement « Les mises à jour sont disponibles dans l'application installée. ».
- **À valider sur téléphone (📱)** : lisibilité à la plus grande taille de police, annonces TalkBack des panneaux de progression et des encadrés d'alerte, lisibilité du russe (chaînes longues sur les boutons de panneau), comportement du bouton Retour pendant les opérations, thème sombre.
