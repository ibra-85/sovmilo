import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { sizes, space } from '@/theme/layout';

import { IconButton } from './icon-button';
import { Text } from './text';

interface ScreenHeaderProps {
  title: string;
  /** Écran racine : logotype « Sovmilo » de l'Accueil (24 sp) au lieu du titre d'écran (26 sp). */
  logotype?: boolean;
  /** Présent : écran secondaire, avec bouton retour de 44 dp à gauche et titre de 20 sp. Absent : écran racine. */
  onBack?: () => void;
  /** Nom du bouton retour pour TalkBack (« Retour aux budgets »). */
  backLabel?: string;
  /** À droite : sélecteur de période (écrans racine) ou bouton « ⋯ » (écrans secondaires). */
  trailing?: ReactNode;
}

/**
 * En-tête d'écran (design « ScreenHeader »), 56 dp. Racine : titre à gauche, sélecteur de période à droite. Secondaire :
 * bouton retour, titre, éventuellement « ⋯ ». Le titre tient sur une ligne ; il est annoncé comme un titre par TalkBack.
 */
export function ScreenHeader({ title, logotype = false, onBack, backLabel, trailing }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const secondary = onBack !== undefined;

  return (
    <View
      style={{
        minHeight: sizes.header,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: space.screen,
      }}>
      {secondary && <IconButton icon="back" label={backLabel ?? t('common.back')} onPress={onBack} />}
      <Text
        variant={logotype ? 'logotype' : secondary ? 'titleScreen' : 'titleRoot'}
        accessibilityRole="header"
        numberOfLines={1}
        style={{ flex: 1 }}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}
