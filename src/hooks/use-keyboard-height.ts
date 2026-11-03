import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Dernière hauteur de clavier observée (0 tant qu'aucun clavier n'est apparu depuis le lancement). */
let lastKnownHeight = 0;

/**
 * Hauteur du clavier vue lors de sa dernière apparition. Sert à réserver la place du clavier AVANT qu'il n'apparaisse
 * (un panneau dont la hauteur ne change pas quand le clavier arrive ne saute pas). 0 si on ne la connaît pas encore.
 */
export function getLastKeyboardHeight(): number {
  return lastKnownHeight;
}

/**
 * Hauteur du clavier à l'écran (0 quand il est fermé). Utilise les événements du clavier, qui fonctionnent aussi
 * dans une fenêtre `Modal` (là où le suivi d'insets de Reanimated ne fonctionne pas sur Android).
 * Sur iOS, `keyboardWillShow` arrive avant l'animation ; sur Android seul `keyboardDidShow` existe.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      lastKnownHeight = event.endCoordinates.height;
      setHeight(event.endCoordinates.height);
    });
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
