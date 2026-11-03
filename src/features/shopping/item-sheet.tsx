import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Icon, Pressable, Text, TextField } from '@/components/ui';
import { centsToInputString, getCurrencySymbol } from '@/domain/money';
import {
  DEFAULT_SHOPPING_UNIT,
  MAX_ITEM_NAME_LENGTH,
  SHOPPING_UNITS,
  cleanShoppingName,
  defaultQuantityMilli,
  parseQuantity,
  parseUnitPrice,
  priceUnitOf,
  quantityToInputString,
  stepQuantity,
  unitStepMilli,
  validateItemName,
  type QuantityResult,
  type ShoppingUnit,
} from '@/domain/shopping';
import type { ShoppingItem } from '@/db/schema';
import { getLastKeyboardHeight, useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useLocale } from '@/i18n/use-locale';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { QuantityStepper } from './quantity-stepper';
import { addItem, updateItem } from './repository';

interface ItemSheetProps {
  visible: boolean;
  onClose: () => void;
  listId: string;
  /** Article à modifier. Absent : le panneau ajoute des articles à la liste. */
  item?: ShoppingItem;
  /** Suppression demandée depuis le mode modification (bouton explicite, en plus de l'appui long). */
  onDelete?: (item: ShoppingItem) => void;
}

/** Part de la hauteur d'écran réservée au clavier tant qu'on n'a pas encore vu sa vraie hauteur (~30 % sur la plupart des claviers). */
const KEYBOARD_ESTIMATE = 0.4;

type QuantityErrorKey = 'shopping.errors.quantityDecimals' | 'shopping.errors.quantityTooLarge' | 'shopping.errors.quantityInvalid';

function quantityErrorKey(result: QuantityResult): QuantityErrorKey | undefined {
  if (result.ok) return undefined;
  if (result.reason === 'decimals') return 'shopping.errors.quantityDecimals';
  if (result.reason === 'too-large') return 'shopping.errors.quantityTooLarge';
  return 'shopping.errors.quantityInvalid';
}

/**
 * Panneau « Nouvel article » / « Modifier l'article ». Ajout rapide : le nom suffit (1 pièce, sans prix). Après « Ajouter », le
 * panneau reste ouvert, le champ du nom est vidé et reprend le focus : on enchaîne les articles sans rien rouvrir ; « Terminer »
 * le ferme. Quantité par boutons − / + (pas selon l'unité) ou au clavier ; unités en choix visibles ; prix facultatif.
 */
export function ItemSheet({ visible, onClose, listId, item, onDelete }: ItemSheetProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
  const locked = useRef(false);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<ShoppingUnit>(DEFAULT_SHOPPING_UNIT);
  const [quantityText, setQuantityText] = useState('1');
  const [quantityEdited, setQuantityEdited] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [failed, setFailed] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Chaque ouverture repart de l'article à modifier, ou d'un formulaire vierge (réinitialisation au rendu, sans effet).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(item?.name ?? '');
      setUnit(item?.unit ?? DEFAULT_SHOPPING_UNIT);
      setQuantityText(item ? quantityToInputString(item.quantityMilli) : quantityToInputString(defaultQuantityMilli(DEFAULT_SHOPPING_UNIT)));
      setQuantityEdited(item !== undefined);
      setPriceText(item && item.unitPriceCents !== null ? centsToInputString(item.unitPriceCents) : '');
      setFailed(false);
      setLastAdded(null);
    }
  }

  const nameProblem = validateItemName(name);
  const quantity = parseQuantity(quantityText, unit);
  const price = parseUnitPrice(priceText);
  const canSubmit = nameProblem === null && quantity.ok && price.ok;

  const nameError = nameProblem === 'too-long' ? t('shopping.errors.nameTooLong', { max: MAX_ITEM_NAME_LENGTH }) : undefined;
  const quantityKey = quantityEdited ? quantityErrorKey(quantity) : undefined;
  const priceError = price.ok ? undefined : t(price.reason === 'too-large' ? 'shopping.errors.priceTooLarge' : 'shopping.errors.priceInvalid');
  const generalError = failed ? t('shopping.errors.saveFailed') : undefined;

  // Zone défilante bornée : titre, champs et unités défilent, les boutons restent toujours visibles (clavier ouvert, texte
  // agrandi, russe). Hauteur disponible = écran − zones système − clavier − poignée et marges − partie fixe du bas.
  // La place du clavier est RÉSERVÉE dès l'ouverture (dernière hauteur connue, sinon une estimation) : la hauteur du panneau
  // ne change donc pas quand le clavier apparaît ou se ferme, et le panneau ne fait que monter / descendre, sans saut.
  const keyboardReserve = Math.max(keyboardHeight, getLastKeyboardHeight() || Math.round(window.height * KEYBOARD_ESTIMATE));
  // Ligne de confirmation « ajouté » (ajout seulement) : sa place est réservée pour qu'elle n'agrandisse pas le panneau en apparaissant.
  const addedLineHeight = Math.round(22 * Math.min(window.fontScale, 1.5));
  const fixedBottom = 150 + 70 * Math.min(window.fontScale, 1.8) + (item ? 0 : addedLineHeight + 12);
  const scrollMax = Math.max(140, window.height - insets.top - insets.bottom - keyboardReserve - 56 - fixedBottom);

  function changeUnit(next: ShoppingUnit) {
    if (next === unit) return;
    setUnit(next);
    if (!quantityEdited) {
      setQuantityText(quantityToInputString(defaultQuantityMilli(next)));
      return;
    }
    const kept = parseQuantity(quantityText, next);
    if (kept.ok) return;
    // Ex. 1,5 kg → pièces : on garde un entier plausible plutôt que d'effacer la saisie.
    const current = parseQuantity(quantityText, unit);
    if (current.ok && kept.reason === 'decimals') {
      setQuantityText(String(Math.max(1, Math.round(current.milli / 1000))));
    } else {
      setQuantityText(quantityToInputString(defaultQuantityMilli(next)));
      setQuantityEdited(false);
    }
  }

  function step(direction: 1 | -1) {
    const base = quantity.ok ? quantity.milli : defaultQuantityMilli(unit);
    setQuantityText(quantityToInputString(stepQuantity(base, direction * unitStepMilli(unit))));
    setQuantityEdited(true);
  }

  function submit(): boolean {
    if (!canSubmit || !quantity.ok || !price.ok) return false;
    // Deux touchers dans la même fraction de seconde ne doivent enregistrer qu'une fois.
    if (locked.current) return false;
    locked.current = true;
    setTimeout(() => {
      locked.current = false;
    }, 400);
    const cleaned = cleanShoppingName(name);
    const input = { name: cleaned, quantityMilli: quantity.milli, unit, unitPriceCents: price.cents };
    try {
      if (item) updateItem(item.id, input);
      else addItem(listId, input);
      setFailed(false);
      return true;
    } catch {
      locked.current = false;
      setFailed(true);
      return false;
    }
  }

  function save() {
    if (!submit()) return;
    if (item) {
      onClose();
      return;
    }
    // Ajout en série : formulaire vidé, quantité remise à la valeur de l'unité, focus sur le nom.
    setLastAdded(cleanShoppingName(name));
    setName('');
    setPriceText('');
    setQuantityText(quantityToInputString(defaultQuantityMilli(unit)));
    setQuantityEdited(false);
    nameInput.current?.focus();
  }

  const title = t(item ? 'shopping.editTitle' : 'shopping.addTitle');
  const currency = getCurrencySymbol(locale);

  return (
    // Pas d'`autoFocus` : le focus (donc le clavier) est donné une fois le panneau posé, jamais pendant son entrée.
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={title} onPresented={() => nameInput.current?.focus()}>
      <View style={{ gap: 12 }}>
        <ScrollView style={{ maxHeight: scrollMax }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 16 }}>
            <Text variant="titleSheet" accessibilityRole="header">
              {title}
            </Text>

            <TextField
              label={t('shopping.itemNameLabel')}
              showLabel
              placeholder={t('shopping.itemNamePlaceholder')}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setFailed(false);
              }}
              maxLength={MAX_ITEM_NAME_LENGTH + 20}
              autoCapitalize="sentences"
              returnKeyType={item ? 'done' : 'next'}
              // « Entrée » ajoute l'article et garde le clavier ouvert : pas besoin de viser le bouton entre deux articles.
              submitBehavior="submit"
              onSubmitEditing={save}
              error={nameError ?? generalError}
              inputRef={nameInput}
            />

            <View style={{ gap: 8 }}>
              <Text variant="label">{t('shopping.quantityLabel')}</Text>
              <QuantityStepper
                label={t('shopping.quantityLabel')}
                value={quantityText}
                onChangeText={(value) => {
                  setQuantityText(value);
                  setQuantityEdited(true);
                }}
                onStep={step}
                error={quantityKey ? t(quantityKey) : undefined}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text variant="label">{t('shopping.unitLabel')}</Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SHOPPING_UNITS.map((option) => (
                  <UnitChip key={option} label={t(`shopping.units.${option}`)} selected={option === unit} onPress={() => changeUnit(option)} />
                ))}
              </View>
            </View>

            <TextField
              label={t(`shopping.price.${priceUnitOf(unit)}`)}
              showLabel
              placeholder={t('shopping.pricePlaceholder')}
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              maxLength={12}
              returnKeyType="done"
              error={priceError}
              trailing={
                <Text variant="bodyStrong" tone="muted">
                  {currency}
                </Text>
              }
            />
          </View>
        </ScrollView>

        {!item && (
          <View accessibilityLiveRegion="polite" style={{ height: addedLineHeight, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {lastAdded !== null && (
              <>
                <Icon name="check" size={18} color={colors.successIcon} weight="strong" />
                <Text variant="secondary" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {t('shopping.added', { name: lastAdded })}
                </Text>
              </>
            )}
          </View>
        )}

        {item ? (
          <>
            <Button label={t('shopping.saveChanges')} icon="check" disabled={!canSubmit} onPress={save} />
            {onDelete && <Button label={t('shopping.deleteItem')} icon="trash" variant="destructive" onPress={() => onDelete(item)} />}
          </>
        ) : (
          <>
            <Button label={t('shopping.addAction')} icon="createPlus" disabled={!canSubmit} onPress={save} />
            <Button label={t('shopping.finish')} variant="secondary" onPress={onClose} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function UnitChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      pressTranslate={0}
      onPress={onPress}
      hitSlop={2}
      style={{
        minWidth: 56,
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: radius.field,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.surface : colors.field,
        borderWidth: selected ? 1.5 : 0,
        borderColor: colors.selectedBorder,
        boxShadow: selected ? [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: colors.selectedRing }] : undefined,
      }}>
      <Text variant={selected ? 'bodyStrong' : 'body'}>{label}</Text>
    </Pressable>
  );
}
