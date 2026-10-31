import { sizes, space } from '@/theme/layout';
import { typography } from '@/theme/typography';

const line = (variant: keyof typeof typography): number => typography[variant].lineHeight as number;

/**
 * Géométrie des lignes de liste, PARTAGÉE entre la ligne réelle et son squelette : un squelette qui n'aurait pas la
 * hauteur de la ligne qu'il remplace ferait sauter la liste à l'arrivée des données. Les hauteurs sont calculées à partir
 * des jetons (icône, espacements, interlignes de la typographie) et vérifiées par `row-metrics.test.ts`.
 *
 * Valables au réglage de texte par défaut ; quand l'utilisateur agrandit le texte, la ligne réelle grandit (hauteur
 * minimale, pas fixe) et le squelette reste à la hauteur de base, ce qui est acceptable pour un état de quelques instants.
 */
export const rowMetrics = {
  transaction: {
    icon: sizes.rowIcon,
    paddingVertical: space.listRow,
    /** Titre (16 sp) + sous-titre (14 sp) : doit tenir dans l'icône de 44 dp pour que l'icône fixe la hauteur. */
    textHeight: line('body') + line('caption'),
    height: sizes.rowIcon + space.listRow * 2,
  },
  budget: {
    icon: sizes.budgetIcon,
    padding: 14,
    /** Espace entre le nom, la barre et le statut. */
    gap: 8,
    bar: sizes.progressThin,
    /** Nom (16 sp) + barre + statut (14 sp), avec leurs espaces. */
    contentHeight: line('body') + 8 + sizes.progressThin + 8 + line('caption'),
    height: 14 * 2 + line('body') + 8 + sizes.progressThin + 8 + line('caption'),
  },
} as const;
