import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { BottomSheet, Button, Text, TextField } from '@/components/ui';
import { MAX_LIST_NAME_LENGTH, cleanShoppingName, validateListName } from '@/domain/shopping';

import { createList, renameList } from './repository';

interface ListNameSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Liste à renommer. Absente : le panneau crée une nouvelle liste. */
  list?: { id: string; name: string };
  /** Appelé avec l'identifiant de la liste créée (l'écran l'ouvre aussitôt). */
  onCreated?: (id: string, name: string) => void;
  onRenamed?: (id: string, name: string) => void;
}

/** Panneau « Nouvelle liste » / « Renommer la liste » : un seul champ, un seul bouton. Le bouton reste inactif tant que le nom est vide. */
export function ListNameSheet({ visible, onClose, list, onCreated, onRenamed }: ListNameSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const lastSubmit = useRef(0);
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);

  // Chaque ouverture repart d'un champ prérempli (renommer) ou vide (créer), sans effet.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(list?.name ?? '');
      setFailed(false);
    }
  }

  const problem = validateListName(name);
  const canSubmit = problem === null;
  const error = problem === 'too-long' ? t('shopping.errors.nameTooLong', { max: MAX_LIST_NAME_LENGTH }) : failed ? t('shopping.errors.saveFailed') : undefined;

  function submit() {
    if (!canSubmit) return;
    // Deux touchers dans la même fraction de seconde ne doivent créer qu'une liste.
    const now = Date.now();
    if (now - lastSubmit.current < 500) return;
    lastSubmit.current = now;
    const cleaned = cleanShoppingName(name);
    try {
      if (list) {
        renameList(list.id, cleaned);
        onRenamed?.(list.id, cleaned);
      } else {
        const id = createList(cleaned);
        onCreated?.(id, cleaned);
      }
    } catch {
      lastSubmit.current = 0;
      setFailed(true);
    }
  }

  const title = t(list ? 'shopping.renameTitle' : 'shopping.newListTitle');

  return (
    // Focus donné une fois le panneau posé (même coordination que le panneau d'article), pas à son montage.
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={title} onPresented={() => nameInput.current?.focus()}>
      <Text variant="titleSheet" accessibilityRole="header">
        {title}
      </Text>

      <View style={{ marginTop: 16 }}>
        <TextField
          label={t('shopping.listNameLabel')}
          showLabel
          placeholder={t('shopping.listNamePlaceholder')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFailed(false);
          }}
          maxLength={MAX_LIST_NAME_LENGTH + 10}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={error}
          inputRef={nameInput}
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <Button label={t(list ? 'shopping.saveName' : 'shopping.createList')} icon="check" disabled={!canSubmit} onPress={submit} />
      </View>
    </BottomSheet>
  );
}
