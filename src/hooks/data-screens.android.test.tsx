import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { act, useEffect, type ReactElement, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { createRoot } from 'test-renderer';

import { openTestDatabase } from '@/db/test-support';
import { refreshLiveData } from '@/db/live-store';

/*
 * Fichier du projet Jest « android » (préréglage `jest-expo/android` : `Platform.OS === 'android'` dès le chargement). Tests de
 * RENDU avec les vrais hooks de données, une vraie base SQLite (vraies migrations) et les VRAIS `ScrollView` et `RefreshControl`
 * de React Native (ceux de la configuration de test sont des maquettes qui ne reproduisent pas le défaut).
 * Hotfix 6.2.1 : sur Android, `refreshControl` reçoit le défilement comme ENFANT ; un composant maison qui ne l'affichait pas
 * vidait Accueil, Opérations, Budgets, Courses, Factures et Épargne. Ces tests vérifient que les éléments attendus APPARAISSENT
 * après lecture (initiale, changement d'onglet, actualisation répétée, mutation, échec), pas seulement que `refresh()` est appelé.
 *
 * Limites : la base est celle de Node (pas celle du téléphone) et l'événement de changement natif d'`expo-sqlite` est simulé
 * (`notifyChange`) ; la disposition réelle (hauteurs mesurées) ne se vérifie que sur téléphone.
 */

// Le préréglage de test remplace `ScrollView` et `RefreshControl` par des maquettes qui ne reproduisent pas le comportement Android
// (la maquette de `RefreshControl` n'affiche jamais d'enfants) : on charge les VRAIS composants.
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => jest.requireActual('react-native/Libraries/Components/ScrollView/ScrollView'));
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => jest.requireActual('react-native/Libraries/Components/RefreshControl/RefreshControl'));

// `require` est voulu ici : la fabrique de `jest.mock` ne peut pas référencer un import ordinaire.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const mockToast = jest.fn();
jest.mock('@/components/ui', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('@/theme/use-theme', () => ({ useTheme: () => ({ colors: { ink: '#000', surface: '#fff' } }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockState: { db: ReturnType<typeof openTestDatabase>['db'] | null } = { db: null };
jest.mock('@/db/client', () => ({
  get db() {
    return mockState.db;
  },
}));

const mockListeners = new Set<(event: { tableName: string }) => void>();
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (listener: (event: { tableName: string }) => void) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
}));

// Les modules suivants importent `@/db/client` : ils doivent être chargés APRÈS les `jest.mock` ci-dessus.
/* eslint-disable import/first */
import { useDataRefresh } from '@/hooks/use-data-refresh';
import { addTransaction } from '@/features/transactions/repository';
import { useMonthOperations, useMonthTransactions } from '@/features/transactions/use-transactions';
import { setBudget } from '@/features/budgets/repository';
import { useBudgetRows } from '@/features/budgets/use-budgets';
import { createGoal, addMovement } from '@/features/savings/repository';
import { useActiveGoals } from '@/features/savings/use-savings';
import { addItem, createList } from '@/features/shopping/repository';
import { useShoppingItems, useShoppingLists } from '@/features/shopping/use-shopping';
import { createBill, ensureOccurrences } from '@/features/bills/repository';
import { useBillRows } from '@/features/bills/use-bills';
import { seedDefaultCategories } from '@/db/seed';
import { categories } from '@/db/schema';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MONTH = '2026-11';
const TODAY = '2026-11-02';

/** Simule l'événement natif d'expo-sqlite (« la table X a changé »). */
function notifyChange(tableName: string) {
  for (const listener of [...mockListeners]) listener({ tableName });
}

/** Poignée vers l'écran monté (renseignée dans un effet) : le geste « tirer pour actualiser » et l'état de l'indicateur. */
const probe: { refresh: (() => Promise<void>) | null; refreshing: boolean } = { refresh: null, refreshing: false };

/** Un écran de données : le vrai hook d'actualisation, un VRAI ScrollView Android, le vrai `refreshControl`. */
function Screen({ children, enabled = true, before }: { children: ReactNode; enabled?: boolean; before?: () => void | Promise<void> }) {
  const data = useDataRefresh({ enabled, before });
  const { onRefresh, refreshing } = data;
  useEffect(() => {
    probe.refresh = async () => {
      await onRefresh();
    };
    probe.refreshing = refreshing;
  });
  return (
    <View>
      <Text>entete</Text>
      <ScrollView refreshControl={data.refreshControl}>{children}</ScrollView>
    </View>
  );
}

function Operations() {
  const rows = useMonthOperations(MONTH);
  const totals = useMonthTransactions(MONTH);
  return (
    <Screen>
      <Text>{`total:${totals.length}`}</Text>
      {rows.map((row) => (
        <Text key={row.id}>{`op:${row.note}`}</Text>
      ))}
    </Screen>
  );
}

function Budgets() {
  const rows = useBudgetRows();
  return (
    <Screen>
      {rows.map((row) => (
        <Text key={row.categoryId}>{`budget:${row.amountCents}`}</Text>
      ))}
    </Screen>
  );
}

function Goals({ enabled = true }: { enabled?: boolean }) {
  const { goals, summary, loaded } = useActiveGoals();
  return (
    <Screen enabled={enabled}>
      <Text>{`resume:${loaded ? summary.goalCount : 'chargement'}`}</Text>
      {goals.map((goal) => (
        <Text key={goal.id}>{`objectif:${goal.name}:${goal.savedCents}`}</Text>
      ))}
    </Screen>
  );
}

function Lists({ listId }: { listId: string }) {
  const lists = useShoppingLists();
  const summary = useShoppingItems(listId);
  const items = [...summary.todo, ...summary.done];
  return (
    <Screen>
      {lists.map((list) => (
        <Text key={list.id}>{`liste:${list.name}`}</Text>
      ))}
      {items.map((item) => (
        <Text key={item.id}>{`article:${item.name}`}</Text>
      ))}
    </Screen>
  );
}

function Bills() {
  const { rows, loaded } = useBillRows();
  return (
    <Screen>
      <Text>{`factures:${loaded ? 'ok' : 'chargement'}`}</Text>
      {rows.map((row) => (
        <Text key={row.id}>{`facture:${row.name}`}</Text>
      ))}
    </Screen>
  );
}

type Root = ReturnType<typeof createRoot>;

type OutputNode = string | { children?: OutputNode[] };

/** Tout le texte affiché, dans l'ordre (les propriétés des éléments ne sont pas lues : elles contiennent des éléments React). */
function everything(root: Root): string {
  const parts: string[] = [];
  const walk = (node: OutputNode) => {
    if (typeof node === 'string') parts.push(node);
    else node.children?.forEach(walk);
  };
  walk(root.container.toJSON() as unknown as OutputNode);
  return parts.join('\n');
}

async function mount(element: ReactElement): Promise<Root> {
  const root = createRoot();
  await act(async () => {
    root.render(element);
  });
  // Laisse les lectures asynchrones de Drizzle (`query.then`) se terminer et être appliquées.
  await act(async () => {
    await Promise.resolve();
  });
  return root;
}

/** Exécute `work` en laissant React planifier ses rendus tout seul (sans `act`), puis les laisse se terminer. */
async function withoutAct(work: () => Promise<void>) {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await work();
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = true;
  }
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let tempDir: string;
let database: ReturnType<typeof openTestDatabase>;

beforeEach(() => {
  expect(Platform.OS).toBe('android');
  mockListeners.clear();
  mockToast.mockClear();
  probe.refresh = null;
  probe.refreshing = false;
  tempDir = mkdtempSync(path.join(tmpdir(), 'sovmilo-render-'));
  database = openTestDatabase(path.join(tempDir, 'sovmilo.db'));
  mockState.db = database.db;
  seedDefaultCategories(database.db);
});

afterEach(() => {
  mockState.db = null;
  try {
    database.close();
  } catch {
    // déjà fermée par le test (redémarrage simulé)
  }
  rmSync(tempDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

function firstExpenseCategoryId(): string {
  const row = database.db.select().from(categories).all().find((category) => category.kind === 'expense');
  if (!row) throw new Error('Aucune catégorie de dépense');
  return row.id;
}

function addOperation(note: string, cents = 1250) {
  return addTransaction({
    type: 'expense',
    amountCents: cents,
    categoryId: firstExpenseCategoryId(),
    paymentMethod: 'card',
    occurredOn: TODAY,
    note,
  });
}

describe('garde-fou Android : le contenu du défilement survit au refreshControl', () => {
  it('un composant maison qui ignore ses enfants vide l\'écran (le défaut du Lot 6.2B), le vrai RefreshControl non', async () => {
    const { RefreshControl } = jest.requireActual<typeof import('react-native')>('react-native');
    const Broken = () => <RefreshControl refreshing={false} onRefresh={() => {}} />;
    const broken = await mount(
      <ScrollView refreshControl={<Broken />}>
        <Text>contenu-visible</Text>
      </ScrollView>,
    );
    expect(everything(broken)).not.toContain('contenu-visible');

    const working = await mount(
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} />}>
        <Text>contenu-visible</Text>
      </ScrollView>,
    );
    expect(everything(working)).toContain('contenu-visible');
  });
});

describe('Opérations / Accueil', () => {
  it('affiche les opérations dès le premier rendu, sans aucune actualisation', async () => {
    addOperation('courses');
    addOperation('pharmacie');
    const root = await mount(<Operations />);
    const out = everything(root);
    expect(out).toContain('entete');
    expect(out).toContain('op:courses');
    expect(out).toContain('op:pharmacie');
    expect(out).toContain('total:2');
  });

  it('une nouvelle opération apparaît (événement de changement), et une actualisation ne fait rien disparaître', async () => {
    addOperation('courses');
    const root = await mount(<Operations />);
    addOperation('essence');
    await act(async () => {
      notifyChange('transactions');
    });
    await settle();
    expect(everything(root)).toContain('op:essence');

    await act(async () => {
      await probe.refresh?.();
    });
    await settle();
    const out = everything(root);
    expect(out).toContain('op:courses');
    expect(out).toContain('op:essence');
    expect(probe.refreshing).toBe(false);
  });

  it('plusieurs actualisations successives gardent exactement les mêmes éléments', async () => {
    addOperation('a');
    addOperation('b');
    addOperation('c');
    const root = await mount(<Operations />);
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await probe.refresh?.();
      });
      await settle();
      const out = everything(root);
      expect(out).toContain('total:3');
      for (const note of ['a', 'b', 'c']) expect(out).toContain(`op:${note}`);
    }
  });

  it('actualiser pendant une écriture ne perd ni l\'ancienne ni la nouvelle opération', async () => {
    addOperation('avant');
    const root = await mount(<Operations />);
    await act(async () => {
      const pending = probe.refresh?.();
      addOperation('pendant');
      notifyChange('transactions');
      await pending;
    });
    await settle();
    const out = everything(root);
    expect(out).toContain('op:avant');
    expect(out).toContain('op:pendant');
  });

  it('changer d\'onglet (démontage puis remontage) et revenir réaffiche les données', async () => {
    addOperation('courses');
    for (let i = 0; i < 3; i += 1) {
      const root = await mount(<Operations />);
      expect(everything(root)).toContain('op:courses');
      await act(async () => {
        root.unmount();
      });
    }
    expect(mockListeners.size).toBe(0);
  });

  it('un échec de lecture pendant l\'actualisation est signalé, l\'indicateur s\'arrête et l\'état déjà affiché reste', async () => {
    addOperation('courses');
    const root = await mount(<Operations />);
    expect(everything(root)).toContain('op:courses');

    // Cadence réelle d'une image (environ 16 ms) : sous Jest `requestAnimationFrame` répond à 0 ms, ce qui ne laisse pas à React le
    // temps d'enregistrer l'erreur avant que l'actualisation ne la lise. Sur téléphone, deux images suffisent.
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => setTimeout(() => callback(0), 16) as unknown as number);
    // Vraie panne de lecture : la table est momentanément introuvable pour SQLite (aucune donnée n'est touchée, on la renomme puis on la rétablit).
    database.sqlite.exec('ALTER TABLE transactions RENAME TO transactions_indisponible');
    // Hors `act`, comme dans l'application : `act` retiendrait les rendus jusqu'à sa sortie et l'erreur ne serait pas encore lue.
    await withoutAct(async () => {
      await probe.refresh?.();
    });
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ message: 'common.refreshFailed' });
    expect(probe.refreshing).toBe(false);
    // Un simple échec de relecture ne vide pas ce qui était déjà affiché.
    expect(everything(root)).toContain('op:courses');

    database.sqlite.exec('ALTER TABLE transactions_indisponible RENAME TO transactions');
    await withoutAct(async () => {
      await probe.refresh?.();
    });
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(everything(root)).toContain('op:courses');
    expect(probe.refreshing).toBe(false);
  });
});

describe('Budgets', () => {
  it('affiche plusieurs budgets au premier rendu et après actualisations', async () => {
    const categoriesRows = database.db.select().from(categories).all().filter((category) => category.kind === 'expense').slice(0, 3);
    categoriesRows.forEach((category, index) => setBudget(category.id, MONTH, (index + 1) * 10_000));
    const root = await mount(<Budgets />);
    for (const cents of [10_000, 20_000, 30_000]) expect(everything(root)).toContain(`budget:${cents}`);
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await probe.refresh?.();
      });
      await settle();
      for (const cents of [10_000, 20_000, 30_000]) expect(everything(root)).toContain(`budget:${cents}`);
    }
  });
});

describe('Épargne', () => {
  it('affiche plusieurs objectifs avec leurs mouvements, puis un objectif créé après coup', async () => {
    const holiday = createGoal({ name: 'Vacances', targetCents: 200_000, icon: '🏖️', targetDate: null, note: null }, TODAY);
    createGoal({ name: 'Voiture', targetCents: 1_000_000, icon: '🚗', targetDate: null, note: null }, TODAY);
    addMovement(holiday, { kind: 'deposit', amountCents: 50_000, occurredOn: TODAY, note: null }, TODAY);
    const root = await mount(<Goals />);
    let out = everything(root);
    expect(out).toContain('resume:2');
    expect(out).toContain('objectif:Vacances:50000');
    expect(out).toContain('objectif:Voiture:0');

    // Le scénario signalé : créer l'objectif « Test » doit le faire apparaître.
    createGoal({ name: 'Test', targetCents: 10_000, icon: '🎯', targetDate: null, note: null }, TODAY);
    await act(async () => {
      notifyChange('savings_goals');
    });
    await settle();
    out = everything(root);
    expect(out).toContain('objectif:Test:0');
    expect(out).toContain('resume:3');

    await act(async () => {
      await probe.refresh?.();
    });
    await settle();
    out = everything(root);
    expect(out).toContain('objectif:Vacances:50000');
    expect(out).toContain('objectif:Test:0');
  });

  it('pendant Réorganiser (actualisation désactivée), rien n\'est relu mais tout reste affiché', async () => {
    createGoal({ name: 'Vacances', targetCents: 200_000, icon: '🏖️', targetDate: null, note: null }, TODAY);
    const root = await mount(<Goals enabled={false} />);
    await act(async () => {
      await probe.refresh?.();
    });
    expect(everything(root)).toContain('objectif:Vacances:0');
    expect(probe.refreshing).toBe(false);
  });
});

describe('Courses', () => {
  it('affiche listes et articles, et les garde après actualisation', async () => {
    const listId = createList('Marché');
    createList('Pharmacie');
    addItem(listId, { name: 'Pommes', quantityMilli: 2000, unit: 'piece', unitPriceCents: null });
    addItem(listId, { name: 'Pain', quantityMilli: 1000, unit: 'piece', unitPriceCents: null });
    const root = await mount(<Lists listId={listId} />);
    let out = everything(root);
    for (const text of ['liste:Marché', 'liste:Pharmacie', 'article:Pommes', 'article:Pain']) expect(out).toContain(text);
    await act(async () => {
      await probe.refresh?.();
    });
    await settle();
    out = everything(root);
    for (const text of ['liste:Marché', 'liste:Pharmacie', 'article:Pommes', 'article:Pain']) expect(out).toContain(text);
  });
});

describe('Factures', () => {
  it('affiche les échéances, y compris celles complétées par le travail préalable de l\'actualisation', async () => {
    createBill({ name: 'Loyer', expectedAmountCents: 80_000, recurrence: 'monthly', nextDueOn: '2026-11-05', note: null }, TODAY);
    const root = await mount(<Bills />);
    expect(everything(root)).toContain('facture:Loyer');
    await act(async () => {
      await probe.refresh?.();
    });
    await settle();
    expect(everything(root)).toContain('facture:Loyer');
    expect(ensureOccurrences(TODAY, MONTH)).toBeGreaterThanOrEqual(0);
  });
});

describe('persistance après redémarrage', () => {
  it('rouvrir le même fichier de base retrouve et réaffiche toutes les données', async () => {
    addOperation('courses');
    createGoal({ name: 'Vacances', targetCents: 200_000, icon: '🏖️', targetDate: null, note: null }, TODAY);
    const file = path.join(tempDir, 'sovmilo.db');
    database.close();
    database = openTestDatabase(file);
    mockState.db = database.db;
    const operations = await mount(<Operations />);
    expect(everything(operations)).toContain('op:courses');
    const goals = await mount(<Goals />);
    expect(everything(goals)).toContain('objectif:Vacances:0');
  });
});

describe('cohérence de l\'époque des données', () => {
  it('une relecture globale ne remplace jamais des données valides par un état vide', async () => {
    addOperation('courses');
    const root = await mount(<Operations />);
    await act(async () => {
      refreshLiveData();
      refreshLiveData();
    });
    await settle();
    expect(everything(root)).toContain('op:courses');
  });
});
