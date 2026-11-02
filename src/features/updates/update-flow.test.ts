import { applyUpdate, checkForUpdate, isNetworkFailure, unavailableReason, type UpdateEnvironment, type UpdatesApi, type UpdateState } from './update-flow';

const READY: UpdateEnvironment = { isExpoGo: false, isDevelopmentBuild: false, isUpdatesEnabled: true };
const NOW = () => new Date('2026-11-02T10:00:00.000Z');

function fakeApi(overrides: Partial<UpdatesApi> = {}): UpdatesApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    checkForUpdateAsync: async () => {
      calls.push('check');
      return { isAvailable: false };
    },
    fetchUpdateAsync: async () => {
      calls.push('fetch');
      return { isNew: true };
    },
    reloadAsync: async () => {
      calls.push('reload');
    },
    ...overrides,
  };
}

async function run(api: UpdatesApi, environment: UpdateEnvironment = READY) {
  const states: UpdateState[] = [];
  const final = await checkForUpdate(api, environment, (state) => states.push(state), NOW);
  return { final, phases: states.map((state) => state.phase) };
}

describe('disponibilité', () => {
  it('Expo Go : indisponible, aucune API native appelée', async () => {
    const api = fakeApi();
    const { final, phases } = await run(api, { ...READY, isExpoGo: true });
    expect(final).toEqual({ phase: 'unavailable', reason: 'expoGo' });
    expect(phases).toEqual(['unavailable']);
    expect(api.calls).toEqual([]);
  });

  it('priorités : Expo Go, puis développement, puis configuration absente', () => {
    expect(unavailableReason({ isExpoGo: true, isDevelopmentBuild: true, isUpdatesEnabled: false })).toBe('expoGo');
    expect(unavailableReason({ isExpoGo: false, isDevelopmentBuild: true, isUpdatesEnabled: false })).toBe('development');
    expect(unavailableReason({ isExpoGo: false, isDevelopmentBuild: false, isUpdatesEnabled: false })).toBe('notConfigured');
    expect(unavailableReason(READY)).toBeNull();
  });
});

describe('vérification', () => {
  it('application à jour : aucun téléchargement', async () => {
    const api = fakeApi();
    const { final, phases } = await run(api);
    expect(final).toEqual({ phase: 'upToDate', checkedAt: '2026-11-02T10:00:00.000Z' });
    expect(phases).toEqual(['checking', 'upToDate']);
    expect(api.calls).toEqual(['check']);
  });

  it('mise à jour disponible : téléchargée, mais PAS appliquée', async () => {
    const api = fakeApi({ checkForUpdateAsync: async () => ({ isAvailable: true }) });
    const { final, phases } = await run(api);
    expect(final).toMatchObject({ phase: 'downloaded' });
    expect(phases).toEqual(['checking', 'downloading', 'downloaded']);
    expect(api.calls).toEqual(['fetch']);
    expect(api.calls).not.toContain('reload');
  });

  it('téléchargement qui ne ramène rien de nouveau : à jour', async () => {
    const api = fakeApi({ checkForUpdateAsync: async () => ({ isAvailable: true }), fetchUpdateAsync: async () => ({ isNew: false }) });
    expect((await run(api)).final).toMatchObject({ phase: 'upToDate' });
  });

  it('hors connexion et échec réseau : message « aucune connexion »', async () => {
    for (const message of ['Network request failed', 'Unable to resolve host u.expo.dev', 'java.net.UnknownHostException', 'Software caused connection abort']) {
      const api = fakeApi({
        checkForUpdateAsync: async () => {
          throw new Error(message);
        },
      });
      expect((await run(api)).final).toEqual({ phase: 'offline' });
    }
  });

  it('échec pendant le téléchargement : erreur, rien d\'appliqué', async () => {
    const api = fakeApi({
      checkForUpdateAsync: async () => ({ isAvailable: true }),
      fetchUpdateAsync: async () => {
        throw new Error('Asset hash mismatch');
      },
    });
    const { final } = await run(api);
    expect(final).toEqual({ phase: 'error' });
    expect(api.calls).not.toContain('reload');
  });

  it('classe les pannes de réseau', () => {
    expect(isNetworkFailure(new Error('The Internet connection appears to be offline'))).toBe(true);
    expect(isNetworkFailure(new Error('Request timed out'))).toBe(true);
    expect(isNetworkFailure(new Error('Invalid manifest'))).toBe(false);
  });
});

describe('application de la mise à jour', () => {
  it('redémarre quand rien de critique n\'est en cours', async () => {
    const api = fakeApi();
    expect(await applyUpdate(api, () => false)).toBe('applying');
    expect(api.calls).toEqual(['reload']);
  });

  it('refuse pendant une sauvegarde ou une restauration', async () => {
    const api = fakeApi();
    expect(await applyUpdate(api, () => true)).toBe('blocked');
    expect(api.calls).toEqual([]);
  });

  it('une erreur au redémarrage est signalée', async () => {
    const api = fakeApi({
      reloadAsync: async () => {
        throw new Error('reload impossible');
      },
    });
    expect(await applyUpdate(api, () => false)).toBe('error');
  });
});
