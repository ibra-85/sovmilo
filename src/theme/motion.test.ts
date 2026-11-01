import { durations, springPerceivedDuration } from './motion';

describe('ressorts', () => {
  it('convertit une durée réelle en durée perçue (réelle ≈ 1,5 × perçue)', () => {
    expect(springPerceivedDuration(300)).toBe(200);
    expect(springPerceivedDuration(220)).toBe(147);
  });

  it('ne donne jamais une durée nulle ou négative', () => {
    expect(springPerceivedDuration(0)).toBe(1);
    expect(springPerceivedDuration(-5)).toBe(1);
  });

  it('les durées d’ouverture restent plus longues que celles de fermeture (fermer est plus rapide)', () => {
    expect(durations.sheetIn).toBeGreaterThan(durations.sheetOut);
    expect(durations.menuIn).toBeGreaterThan(durations.menuOut);
    expect(durations.dropdownIn).toBeGreaterThan(durations.dropdownOut);
  });
});
