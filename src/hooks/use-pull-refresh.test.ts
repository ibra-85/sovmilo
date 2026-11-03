import { runGuarded } from './use-pull-refresh';

describe('runGuarded (tirer pour actualiser)', () => {
  it('exécute la tâche et relâche le verrou (tâche synchrone)', async () => {
    const gate = { running: false };
    const task = jest.fn();
    await expect(runGuarded(gate, task)).resolves.toBe('done');
    expect(task).toHaveBeenCalledTimes(1);
    expect(gate.running).toBe(false);
  });

  it('attend une tâche asynchrone avant de relâcher le verrou', async () => {
    const gate = { running: false };
    let release: () => void = () => undefined;
    const pending = runGuarded(gate, () => new Promise<void>((resolve) => (release = resolve)));
    expect(gate.running).toBe(true);
    release();
    await expect(pending).resolves.toBe('done');
    expect(gate.running).toBe(false);
  });

  it('ignore un second tirage pendant une actualisation en cours (une seule exécution)', async () => {
    const gate = { running: false };
    let release: () => void = () => undefined;
    const slow = jest.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const first = runGuarded(gate, slow);
    const second = await runGuarded(gate, slow);
    expect(second).toBe('skipped');
    expect(slow).toHaveBeenCalledTimes(1);
    release();
    await first;
    // Une fois terminée, une nouvelle actualisation est de nouveau possible.
    await expect(runGuarded(gate, jest.fn())).resolves.toBe('done');
  });

  it('signale l\'échec (erreur synchrone ou rejet) et relâche quand même le verrou', async () => {
    const gate = { running: false };
    await expect(
      runGuarded(gate, () => {
        throw new Error('lecture impossible');
      }),
    ).resolves.toBe('failed');
    expect(gate.running).toBe(false);
    await expect(runGuarded(gate, () => Promise.reject(new Error('échec')))).resolves.toBe('failed');
    expect(gate.running).toBe(false);
    await expect(runGuarded(gate, jest.fn())).resolves.toBe('done');
  });
});
