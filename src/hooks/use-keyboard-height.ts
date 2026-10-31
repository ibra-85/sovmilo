import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hauteur du clavier à l'écran (0 quand il est fermé). Utilise les événements du clavier, qui fonctionnent aussi
 * dans une fenêtre `Modal` (là où le suivi d'insets de Reanimated ne fonctionne pas sur Android).
 * Sur iOS, `keyboardWillShow` arrive avant l'animation ; sur Android seul `keyboardDidShow` existe.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
