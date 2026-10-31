import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { Surface } from './surface';
import { Text } from './text';

/** Groupe de lignes sur une même surface (rayon 18), un filet indenté sous l'icône entre deux lignes. */
export function FieldGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 && <Divider inset={space.fieldDividerInset} />}
          {row}
        </Fragment>
      ))}
    </Surface>
  );
}

interface FormRowProps {
  /** Icône du catalogue. Ignorée si `iconNode` est fourni. */
  icon?: IconName;
  /** Contenu libre dans la pastille (icône ou emoji d'une catégorie). */
  iconNode?: ReactNode;
  /** Légende (« Date », « Note »). */
  label: string;
  /** Valeur affichée (« Aujourd'hui, 31 oct. »). Absente : `placeholder` en gris (« Facultative »). */
  value?: string;
  placeholder?: string;
  /** Présent : la ligne est touchable et affiche un chevron. Absent : ligne fixe (catégorie, période d'un budget). */
  onPress?: () => void;
  disabled?: boolean;
}

/** Ligne de formulaire (FormField) ou ligne fixe à icône (InfoRow avec icône) : 58 dp minimum, icône dans une pastille de 36 dp. */
export function FormRow({ icon, iconNode, label, value, placeholder, onPress, disabled = false }: FormRowProps) {
  const { colors } = useTheme();
  const text = value ?? placeholder ?? '';

  const content = (
    <View
      style={{
        minHeight: space.fieldMinHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.gutter,
        paddingHorizontal: space.gutter,
        paddingVertical: 8,
      }}>
      <View
        style={{
          width: sizes.fieldIcon,
          height: sizes.fieldIcon,
          borderRadius: radius.iconPad,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
        }}>
        {iconNode ?? (icon ? <Icon name={icon} size={18} /> : null)}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="fieldValue" tone={value === undefined ? 'muted' : 'default'}>
          {text}
        </Text>
      </View>
      {onPress && <Icon name="chevronRight" size={18} color={colors.textMuted} />}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}, ${text}`}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${text}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      pressTranslate={0}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : 'transparent' })}>
      {content}
    </Pressable>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  /** Pastille d'icône devant la valeur (ligne « Catégorie » du détail d'une opération). */
  leading?: ReactNode;
}

/** Information non modifiable en clé / valeur (détail d'une opération ou d'un budget) : clé à gauche, valeur à droite. */
export function InfoRow({ label, value, leading }: InfoRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{
        minHeight: space.fieldMinHeight - 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.gutter,
        paddingHorizontal: space.gutter,
        paddingVertical: 12,
      }}>
      <Text variant="secondary" tone="muted">
        {label}
      </Text>
      <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {leading}
        <Text variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
