import { Pressable, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` pour un choix unique parmi plusieurs, `button` pour un interrupteur isolé. */
  role?: 'radio' | 'button';
  /** Pour les chips qui partagent la largeur d'une ligne (ex. les trois types d'opération). */
  grow?: boolean;
}

/** Bouton de choix : 56 dp de haut (≥ 56 dp exigés), texte 16 sp. Sauge quand il est sélectionné. */
export function Chip({ label, selected, onPress, role = 'radio', grow = false }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-14 items-center justify-center rounded-2xl border-2 active:opacity-70 ${grow ? 'flex-1 px-2' : 'px-4'} ${
        selected ? 'border-sage bg-sage-soft' : 'border-line bg-surface'
      }`}>
      <Text numberOfLines={1} className={`text-base font-semibold ${selected ? 'text-sage' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
