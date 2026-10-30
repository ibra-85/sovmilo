import { Pressable, Text } from 'react-native';

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  /** `coral` pour une action destructrice (suppression). */
  tone?: 'sage' | 'coral';
}

/** Bouton secondaire à contour : 56 dp de haut, texte 18 sp gras. */
export function OutlineButton({ label, onPress, tone = 'sage' }: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-[56px] items-center justify-center rounded-2xl border-2 px-5 active:opacity-70 ${
        tone === 'coral' ? 'border-coral' : 'border-sage'
      }`}>
      <Text className={`text-lg font-bold ${tone === 'coral' ? 'text-coral' : 'text-sage'}`}>{label}</Text>
    </Pressable>
  );
}
