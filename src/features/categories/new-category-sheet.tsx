import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';

import { BottomSheet, Button, CategoryIcon, Icon, Pressable, SegmentedControl, Text, TextField } from '@/components/ui';
import { CATEGORY_ICON_IDS, serializeCategoryIcon, type CategoryIcon as CategoryIconValue } from '@/domain/category-icon';
import { MAX_CATEGORY_NAME_LENGTH, cleanCategoryName, validateCategoryName } from '@/domain/category-name';
import { EMOJI_CHOICES } from '@/domain/emoji-choices';
import type { CategoryKind } from '@/domain/types';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { categoryLabel } from './category-label';
import { createCategory } from './repository';
import { useCategories } from './use-categories';

interface NewCategorySheetProps {
  visible: boolean;
  kind: CategoryKind;
  onClose: () => void;
  /** Appelé avec l'identifiant et le nom de la catégorie créée (pour la sélectionner et afficher la notification). */
  onCreated: (id: string, name: string) => void;
}

type PickerTab = 'icons' | 'emojis';

const CELL = 48;
const DEFAULT_ICON: CategoryIconValue = { kind: 'icon', id: 'tag' };

/**
 * Panneau « Nouvelle catégorie » (CAT-01 à CAT-04) : nom + carré d'icône. Toucher le carré ouvre le sélecteur Icônes /
 * Emojis DANS le même panneau (le clavier se ferme) ; le bouton clavier revient à la saisie du nom. Bouton désactivé tant que
 * le nom est vide ; « Ce nom existe déjà » en cas de doublon (texte décidé par le design, état d'erreur proposé).
 * Le panneau change de hauteur sans transition (voir `BottomSheet`).
 */
export function NewCategorySheet({ visible, kind, onClose, onCreated }: NewCategorySheetProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();
  const existing = useCategories(kind);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIconValue>(DEFAULT_ICON);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('icons');
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState(false);

  // Chaque ouverture repart d'un panneau vierge (réinitialisation au rendu où `visible` passe à vrai, sans effet).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName('');
      setIcon(DEFAULT_ICON);
      setPickerOpen(false);
      setTab('icons');
      setTouched(false);
      setFailed(false);
    }
  }

  const existingNames = useMemo(() => existing.map((category) => categoryLabel(category, t)), [existing, t]);
  const problem = validateCategoryName(name, existingNames);
  const canCreate = problem === null;
  const error = touched && problem === 'duplicate' ? t('category.duplicate') : failed ? t('category.createError') : undefined;

  function create() {
    if (!canCreate) return;
    const cleaned = cleanCategoryName(name);
    try {
      const id = createCategory({ kind, name: cleaned, icon: serializeCategoryIcon(icon) });
      onCreated(id, cleaned);
    } catch {
      setFailed(true);
    }
  }

  function togglePicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      input.current?.focus();
    } else {
      Keyboard.dismiss();
      setPickerOpen(true);
    }
  }

  const chooser = (
    <View style={{ gap: 12, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('category.backToName')}
          pressTranslate={0}
          onPress={togglePicker}
          style={({ pressed }) => ({
            width: CELL,
            height: CELL,
            borderRadius: radius.iconButton,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.surfaceMuted : colors.field,
          })}>
          <Icon name="keyboard" size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <SegmentedControl<PickerTab>
            accessibilityLabel={t('category.pickerTabs')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'icons', label: t('category.icons') },
              { value: 'emojis', label: t('category.emojis') },
            ]}
          />
        </View>
      </View>

      <ScrollView style={{ maxHeight: 232 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tab === 'icons'
            ? CATEGORY_ICON_IDS.map((id) => (
                <PickerCell
                  key={id}
                  label={t(`category.iconNames.${id}`)}
                  selected={icon.kind === 'icon' && icon.id === id}
                  onPress={() => setIcon({ kind: 'icon', id })}>
                  <CategoryIcon value={`icon:${id}`} size={24} />
                </PickerCell>
              ))
            : EMOJI_CHOICES.map((emoji) => (
                <PickerCell
                  key={emoji}
                  label={emoji}
                  selected={icon.kind === 'emoji' && icon.emoji === emoji}
                  onPress={() => setIcon({ kind: 'emoji', emoji })}>
                  <CategoryIcon value={emoji} size={26} />
                </PickerCell>
              ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={t('category.newTitle')}>
      <Text variant="titleSheet" accessibilityRole="header">
        {t('category.newTitle')}
      </Text>

      <View style={{ marginTop: 16 }}>
        <TextField
          label={t('category.nameLabel')}
          placeholder={t('category.namePlaceholder')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setTouched(true);
            setFailed(false);
          }}
          maxLength={MAX_CATEGORY_NAME_LENGTH + 6}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={create}
          error={error}
          inputRef={input}
          leading={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('category.chooseIcon')}
              accessibilityState={{ expanded: pickerOpen }}
              pressTranslate={0}
              onPress={togglePicker}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.iconButton,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                boxShadow: shadows.tile,
              }}>
              <CategoryIcon value={serializeCategoryIcon(icon)} size={24} />
              <View
                style={{
                  position: 'absolute',
                  right: -5,
                  bottom: -5,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}>
                <Icon name={pickerOpen ? 'chevronUp' : 'chevronDown'} size={11} />
              </View>
            </Pressable>
          }
        />
      </View>

      {pickerOpen && chooser}

      <View style={{ marginTop: 20 }}>
        <Button label={t('category.createAction')} icon="check" disabled={!canCreate} onPress={create} />
      </View>
    </BottomSheet>
  );
}

interface PickerCellProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}

/** Case du sélecteur (design « CategoryPicker ») : 48 dp, rayon 13, fond de champ ; sélection = surface + contour 1,5 dp + halo. */
function PickerCell({ label, selected, onPress, children }: PickerCellProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      pressTranslate={0}
      onPress={onPress}
      style={{
        width: CELL,
        height: CELL,
        borderRadius: radius.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.surface : colors.field,
        borderWidth: selected ? 1.5 : 0,
        borderColor: colors.selectedBorder,
        boxShadow: selected
          ? [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: colors.selectedRing }]
          : undefined,
      }}>
      {children}
    </Pressable>
  );
}
