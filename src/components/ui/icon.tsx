import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

import { iconData, type IconName } from './icon-data';

interface IconProps {
  name: IconName;
  /** Taille d'affichage en dp : 24 (navigation, en-têtes), 18–20 (champs, menus, boutons). */
  size?: number;
  /** Couleur du trait ; par défaut l'encre du thème. */
  color?: string;
  /** Épaisseur de trait ; par défaut celle du design (1,8 en général, 2,2 pour l'onglet actif). */
  strokeWidth?: number;
  /** Texte lu par TalkBack. Sans lui l'icône est décorative et ignorée des lecteurs d'écran. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Icône du design system : tracés exportés des maquettes validées, dessinés avec react-native-svg. */
export function Icon({ name, size = 24, color, strokeWidth, label, style }: IconProps) {
  const theme = useTheme();
  const definition = iconData[name];
  const stroke = color ?? theme.colors.ink;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth ?? definition.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      accessible={label !== undefined}
      accessibilityRole={label !== undefined ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label !== undefined ? 'yes' : 'no-hide-descendants'}>
      {definition.elements.map((element, index) => {
        switch (element.type) {
          case 'path':
            return <Path key={index} d={element.d} />;
          case 'circle':
            return <Circle key={index} cx={element.cx} cy={element.cy} r={element.r} />;
          case 'rect':
            return (
              <Rect
                key={index}
                x={element.x}
                y={element.y}
                width={element.width}
                height={element.height}
                rx={element.rx}
              />
            );
        }
      })}
    </Svg>
  );
}

export type { IconName };
