import { getLiveEpoch, recordLiveError, subscribeLiveEpoch } from '@/db/live-store';
import { refreshAllData } from '@/db/refresh-data';

import { runGuarded } from '@/hooks/use-pull-refresh';

const settled = () => Promise.resolve();

describe('actualisation des données (tirer pour actualiser)', () => {
  it('fait le travail de l\'écran, PUIS relit toutes les requêtes (une époque de plus)', async () => {
    const order: string[] = [];
    const stop = subscribeLiveEpoch(() => order.push('relecture'));
    const before = getLiveEpoch();
    await refreshAllData(() => {
      order.push('écran');
    }, settled);
    stop();
    expect(order).toEqual(['écran', 'relecture']);
    expect(getLiveEpoch()).toBe(before + 1);
  });

  it('attend la fin du travail asynchrone de l\'écran avant de relire', async () => {
    const order: string[] = [];
    const stop = subscribeLiveEpoch(() => order.push('relecture'));
    await refreshAllData(async () => {
      await Promise.resolve();
      order.push('écran terminé');
    }, settled);
    stop();
    expect(order).toEqual(['écran terminé', 'relecture']);
  });

  it('si le travail de l\'écran échoue, rien n\'est relu et l\'échec est signalé', async () => {
    const before = getLiveEpoch();
    await expect(
      refreshAllData(() => {
        throw new Error('échéances impossibles');
      }, settled),
    ).rejects.toThrow('échéances impossibles');
    expect(getLiveEpoch()).toBe(before);
  });

  it('une requête qui échoue pendant la relecture fait échouer l\'actualisation', async () => {
    const stop = subscribeLiveEpoch(() => recordLiveError(new Error('requête illisible')));
    await expect(refreshAllData(undefined, settled)).rejects.toThrow('requête illisible');
    stop();
    // L'erreur est consommée : l'actualisation suivante repart de zéro.
    await expect(refreshAllData(undefined, settled)).resolves.toBeUndefined();
  });

  it('deux tirages rapprochés ne lancent qu\'une relecture (verrou), sans délai artificiel', async () => {
    const gate = { running: false };
    const before = getLiveEpoch();
    let release: () => void = () => undefined;
    const slowSettle = () => new Promise<void>((resolve) => (release = resolve));
    const first = runGuarded(gate, () => refreshAllData(undefined, slowSettle));
    const second = await runGuarded(gate, () => refreshAllData(undefined, slowSettle));
    expect(second).toBe('skipped');
    release();
    await expect(first).resolves.toBe('done');
    expect(getLiveEpoch()).toBe(before + 1);
  });
});
