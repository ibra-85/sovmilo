import type { ReactNode } from 'react';
import { View } from 'react-native';

import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

interface ConfirmDialogProps {
  visible: boolean;
  /** « Supprimer cette opération ? » : une question, pas d'avertissement dramatique. */
  title: string;
  /** Rappel de l'élément concerné (ligne d'opération, nom de budget) sous le titre. */
  children?: ReactNode;
  icon?: IconName;
  cancelLabel: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  /** Action en cours : le bouton confirmer affiche un indicateur, le panneau ne se ferme plus. */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation d'une action destructive, sous forme de panneau inférieur (design « ConfirmDialog ») : icône sur fond
 * d'alerte doux, question, rappel de l'élément, puis « Annuler » (secondaire) et l'action (destructif doux) côte à
 * côte. Aucune promesse de récupération : l'annulation éventuelle est proposée APRÈS l'action par la notification.
 * Les deux boutons ont la même largeur ; un libellé russe long peut passer sur deux lignes.
 */
export function ConfirmDialog({
  visible,
  title,
  children,
  icon = 'trash',
  cancelLabel,
  confirmLabel,
  confirmIcon = 'trash',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onCancel} accessibilityLabel={title} dismissible={!busy}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.iconButton,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.dangerSoft,
          borderWidth: 1,
          borderColor: colors.dangerLine,
        }}>
        <Icon name={icon} size={22} color={colors.danger} />
      </View>

      <Text variant="titleSheet" accessibilityRole="header" style={{ marginTop: 16 }}>
        {title}
      </Text>

      {children !== undefined && <View style={{ marginTop: 16 }}>{children}</View>}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.screen }}>
        <Button label={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label={confirmLabel}
          variant="destructive"
          icon={confirmIcon}
          loading={busy}
          onPress={onConfirm}
          style={{ flex: 1 }}
        />
      </View>
    </BottomSheet>
  );
}
