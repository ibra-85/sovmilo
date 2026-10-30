import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

interface BigButtonProps {
  label: string;
  onPress: () => void;
  /** Texte lu par TalkBack si différent du libellé affiché (ex. « ✓ » → « Valider »). */
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

/** Bouton principal : 72 dp de haut (≥ 56 dp exigés), texte 22 sp gras. */
export function BigButton({ label, onPress, accessibilityLabel, disabled = false, icon }: BigButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[72px] flex-row items-center justify-center gap-3 rounded-3xl px-6 ${
        disabled ? 'bg-line' : 'bg-sage active:opacity-80'
      }`}>
      {icon}
      <Text className={`text-2xl font-bold ${disabled ? 'text-muted' : 'text-on-accent'}`}>{label}</Text>
    </Pressable>
  );
}
