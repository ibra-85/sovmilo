import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Airplane01Icon from '@hugeicons/core-free-icons/Airplane01Icon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import ArrowDataTransferVerticalIcon from '@hugeicons/core-free-icons/ArrowDataTransferVerticalIcon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import ArrowDownLeft01Icon from '@hugeicons/core-free-icons/ArrowDownLeft01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Book02Icon from '@hugeicons/core-free-icons/Book02Icon';
import Bread01Icon from '@hugeicons/core-free-icons/Bread01Icon';
import BusIcon from '@hugeicons/core-free-icons/Bus01Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Coffee01Icon from '@hugeicons/core-free-icons/Coffee01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Download01Icon from '@hugeicons/core-free-icons/Download01Icon';
import FirstAidKitIcon from '@hugeicons/core-free-icons/FirstAidKitIcon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import GridViewIcon from '@hugeicons/core-free-icons/GridViewIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import House04Icon from '@hugeicons/core-free-icons/House04Icon';
import Invoice01Icon from '@hugeicons/core-free-icons/Invoice01Icon';
import KeyboardIcon from '@hugeicons/core-free-icons/KeyboardIcon';
import Loading03Icon from '@hugeicons/core-free-icons/Loading03Icon';
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon';
import PawPrintIcon from '@hugeicons/core-free-icons/PawPrintIcon';
import PencilEdit01Icon from '@hugeicons/core-free-icons/PencilEdit01Icon';
import PiggyBankIcon from '@hugeicons/core-free-icons/PiggyBankIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Shirt01Icon from '@hugeicons/core-free-icons/Shirt01Icon';
import ShoppingBasket01Icon from '@hugeicons/core-free-icons/ShoppingBasket01Icon';
import ShoppingCart01Icon from '@hugeicons/core-free-icons/ShoppingCart01Icon';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import Tag01Icon from '@hugeicons/core-free-icons/Tag01Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import Upload01Icon from '@hugeicons/core-free-icons/Upload01Icon';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
// Une icône = un import par fichier (« @hugeicons/core-free-icons/<Nom> ») : l'import groupé depuis la racine
// embarquait les ~5 000 icônes dans l'application (bundle de 13 Mo au lieu de 5 Mo, mesuré le 31/10/2026).
import type { IconSvgElement } from '@hugeicons/react-native';

import type { CategoryIconId } from '@/domain/category-icon';

/**
 * Catalogue des icônes de Sovmilo : UNE famille (Hugeicons gratuit, Stroke Rounded) et UN seul endroit où un nom
 * sémantique est relié à un dessin. Pour changer une icône dans toute l'application, on ne modifie que la ligne
 * correspondante. Les écrans n'importent jamais Hugeicons directement : ils passent par `<Icon name="…" />`.
 *
 * Imports statiques et nommés : seules les icônes listées ici sont utilisées (le reste du catalogue n'est pas
 * référencé). Les choix sont des équivalents proches des maquettes, pas des copies : voir docs/design-deviations.md.
 */

/** Icônes d'interface (navigation, actions, états). */
const interfaceIcons = {
  // Navigation principale
  home: Home01Icon,
  transactions: ArrowDataTransferVerticalIcon, // « Opérations » : flèches entrée / sortie (ajustement V5.2 demandé)
  budgets: Wallet01Icon,
  services: GridViewIcon,

  // Actions
  plus: Add01Icon,
  close: Cancel01Icon,
  expense: Upload01Icon, // « Ajouter une dépense »
  income: Download01Icon, // « Ajouter un revenu »
  scanReceipt: Camera01Icon,
  createPlus: Add01Icon,
  check: Tick02Icon,
  trash: Delete02Icon,
  note: PencilEdit01Icon,
  search: Search01Icon,
  more: MoreHorizontalIcon,
  keyboard: KeyboardIcon,
  calendar: Calendar03Icon,

  // Flèches
  back: ArrowLeft01Icon,
  chevronRight: ArrowRight01Icon,
  chevronDown: ArrowDown01Icon,
  chevronUp: ArrowUp01Icon,
  arrowIncome: ArrowUpRight01Icon,
  arrowExpense: ArrowDownLeft01Icon,

  // États
  nearLimit: AlertCircleIcon,
  overBudget: Alert02Icon,
  spinner: Loading03Icon,

  // Réservées aux écrans du lot 5
  savings: PiggyBankIcon,
  settings: Settings02Icon,
} as const satisfies Record<string, IconSvgElement>;

/** Icônes de catégories : leurs identifiants sont stockés en base (voir src/domain/category-icon.ts). */
const categoryIcons = {
  groceries: ShoppingBasket01Icon,
  bills: Invoice01Icon,
  cart: ShoppingCart01Icon,
  bakery: Bread01Icon,
  book: Book02Icon,
  cup: Coffee01Icon,
  gift: GiftIcon,
  health: FirstAidKitIcon,
  paw: PawPrintIcon,
  plane: Airplane01Icon,
  shirt: Shirt01Icon,
  star: StarIcon,
  tag: Tag01Icon,
  transport: BusIcon,
  house: House04Icon,
} as const satisfies Record<CategoryIconId, IconSvgElement>;

export const icons = { ...interfaceIcons, ...categoryIcons } as const;

export type IconName = keyof typeof icons;
