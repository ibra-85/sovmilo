import { act, useEffect } from 'react';
import { createRoot } from 'test-renderer';

import { BackupError } from './format';
import type { InspectedBackup } from './inspect';
import { useBackupFlow, type BackupPhase } from './use-backup-flow';

/*
 * Machine d'états de Paramètres (sauvegarder / restaurer) avec la couche plateforme SIMULÉE : ici on vérifie les ENCHAÎNEMENTS
 * (annulation, refus, retour arrière, double appui, fermeture du fichier ouvert). Le comportement natif ne se teste que sur téléphone.
 */

jest.mock('./platform', () => ({
  readLastBackup: jest.fn(),
  prepareBackup: jest.fn(),
  saveBackup: jest.fn(),
  pickAndInspectBackup: jest.fn(),
  restoreInspectedBackup: jest.fn(),
  discardInspection: jest.fn(),
}));

const mockPlatform = jest.requireMock<Record<'readLastBackup' | 'prepareBackup' | 'saveBackup' | 'pickAndInspectBackup' | 'restoreInspectedBackup' | 'discardInspection', jest.Mock>>('./platform');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Flow = ReturnType<typeof useBackupFlow>;
const probe: { flow: Flow | null } = { flow: null };

function Harness() {
  const flow = useBackupFlow();
  useEffect(() => {
    probe.flow = flow;
  });
  return null;
}

const fakeInspected = { connection: {}, meta: {}, counts: {} } as unknown as InspectedBackup;
const fakeBackup = { bytes: new Uint8Array([1]), fileName: 'sovmilo-backup-2026-11-02-1000.db' };

async function mount() {
  const root = createRoot();
  await act(async () => {
    root.render(<Harness />);
  });
  return root;
}

const phase = (): BackupPhase['kind'] => probe.flow!.phase.kind;

beforeEach(() => {
  jest.resetAllMocks();
  mockPlatform.readLastBackup.mockReturnValue(null);
  mockPlatform.discardInspection.mockResolvedValue(undefined);
  probe.flow = null;
});

describe('sauvegarde', () => {
  it('rien n\'est créé avant la confirmation de l\'avertissement', async () => {
    await mount();
    await act(async () => probe.flow!.startBackup());
    expect(phase()).toBe('warn');
    expect(mockPlatform.prepareBackup).not.toHaveBeenCalled();
  });

  it('succès : « enregistrée » seulement après l\'écriture vérifiée, et la date est mémorisée', async () => {
    mockPlatform.prepareBackup.mockResolvedValue(fakeBackup);
    mockPlatform.saveBackup.mockResolvedValue({ status: 'saved', fileName: fakeBackup.fileName, savedAt: '2026-11-02T10:00:00.000Z' });
    await mount();
    await act(async () => probe.flow!.confirmBackup());
    expect(probe.flow!.phase).toEqual({ kind: 'saved', fileName: fakeBackup.fileName });
    expect(probe.flow!.last).toEqual({ savedAt: '2026-11-02T10:00:00.000Z', fileName: fakeBackup.fileName });
  });

  it('dossier non choisi : « aucun fichier enregistré », aucune date mémorisée', async () => {
    mockPlatform.prepareBackup.mockResolvedValue(fakeBackup);
    mockPlatform.saveBackup.mockResolvedValue({ status: 'cancelled' });
    await mount();
    await act(async () => probe.flow!.confirmBackup());
    expect(phase()).toBe('notSaved');
    expect(probe.flow!.last).toBeNull();
  });

  it('échec d\'écriture : erreur affichée, aucune date mémorisée', async () => {
    mockPlatform.prepareBackup.mockResolvedValue(fakeBackup);
    mockPlatform.saveBackup.mockRejectedValue(new BackupError('storage'));
    await mount();
    await act(async () => probe.flow!.confirmBackup());
    expect(probe.flow!.phase).toEqual({ kind: 'error', code: 'storage' });
    expect(probe.flow!.last).toBeNull();
  });

  it('une seconde demande pendant l\'opération est ignorée', async () => {
    let release: (value: unknown) => void = () => undefined;
    mockPlatform.prepareBackup.mockReturnValue(new Promise((resolve) => (release = resolve)));
    mockPlatform.saveBackup.mockResolvedValue({ status: 'cancelled' });
    await mount();
    let first: Promise<void> | undefined;
    await act(async () => {
      first = probe.flow!.confirmBackup();
    });
    expect(phase()).toBe('busy');
    await act(async () => probe.flow!.confirmBackup());
    expect(mockPlatform.prepareBackup).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(fakeBackup);
      await first;
    });
    expect(phase()).toBe('notSaved');
  });
});

describe('restauration', () => {
  it('sélecteur annulé : retour au repos, rien d\'ouvert', async () => {
    mockPlatform.pickAndInspectBackup.mockResolvedValue({ status: 'cancelled' });
    await mount();
    await act(async () => probe.flow!.startRestore());
    expect(phase()).toBe('idle');
  });

  it('fichier refusé : message d\'erreur, aucune restauration lancée', async () => {
    mockPlatform.pickAndInspectBackup.mockRejectedValue(new BackupError('notSovmilo'));
    await mount();
    await act(async () => probe.flow!.startRestore());
    expect(probe.flow!.phase).toEqual({ kind: 'error', code: 'notSovmilo' });
    expect(mockPlatform.restoreInspectedBackup).not.toHaveBeenCalled();
  });

  it('aperçu puis annulation : le fichier ouvert est refermé, rien n\'est restauré', async () => {
    mockPlatform.pickAndInspectBackup.mockResolvedValue({ status: 'picked', inspected: fakeInspected, fileName: 'x.db' });
    await mount();
    await act(async () => probe.flow!.startRestore());
    expect(phase()).toBe('preview');
    await act(async () => probe.flow!.cancelRestore());
    expect(phase()).toBe('idle');
    expect(mockPlatform.discardInspection).toHaveBeenCalledWith(fakeInspected);
    expect(mockPlatform.restoreInspectedBackup).not.toHaveBeenCalled();
  });

  it.each([
    ['restored', 'restored'],
    ['rolledBack', 'rolledBack'],
    ['failed', 'failed'],
  ] as const)('résultat %s affiché tel quel, jamais « réussi » à la place', async (status, expected) => {
    mockPlatform.pickAndInspectBackup.mockResolvedValue({ status: 'picked', inspected: fakeInspected, fileName: 'x.db' });
    mockPlatform.restoreInspectedBackup.mockResolvedValue({ status, counts: {}, cause: 'corrupt' });
    await mount();
    await act(async () => probe.flow!.startRestore());
    await act(async () => probe.flow!.confirmRestore());
    expect(phase()).toBe(expected);
  });

  it('échec avant toute modification (copie de sécurité impossible) : erreur, données intactes', async () => {
    mockPlatform.pickAndInspectBackup.mockResolvedValue({ status: 'picked', inspected: fakeInspected, fileName: 'x.db' });
    mockPlatform.restoreInspectedBackup.mockRejectedValue(new BackupError('storage'));
    await mount();
    await act(async () => probe.flow!.startRestore());
    await act(async () => probe.flow!.confirmRestore());
    expect(probe.flow!.phase).toEqual({ kind: 'error', code: 'storage' });
  });

  it('écran quitté pendant l\'aperçu : le fichier ouvert est refermé', async () => {
    mockPlatform.pickAndInspectBackup.mockResolvedValue({ status: 'picked', inspected: fakeInspected, fileName: 'x.db' });
    const root = await mount();
    await act(async () => probe.flow!.startRestore());
    await act(async () => root.unmount());
    expect(mockPlatform.discardInspection).toHaveBeenCalledWith(fakeInspected);
  });
});
