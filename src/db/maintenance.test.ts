import { beginMaintenance, currentMaintenance, endMaintenance } from './maintenance';

describe('maintenance de la base', () => {
  afterEach(() => endMaintenance());

  it('une seule opération à la fois', () => {
    expect(currentMaintenance()).toBeNull();
    expect(beginMaintenance('backup')).toBe(true);
    expect(currentMaintenance()).toBe('backup');
    expect(beginMaintenance('restore')).toBe(false);
    expect(currentMaintenance()).toBe('backup');
    endMaintenance();
    expect(currentMaintenance()).toBeNull();
    expect(beginMaintenance('restore')).toBe(true);
  });

  it('terminer sans rien en cours est sans effet', () => {
    endMaintenance();
    expect(currentMaintenance()).toBeNull();
  });
});
