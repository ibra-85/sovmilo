import { rowMetrics } from './row-metrics';

describe('rowMetrics', () => {
  it("l'icône de 44 dp fixe la hauteur d'une ligne d'opération (le texte tient dedans)", () => {
    expect(rowMetrics.transaction.textHeight).toBeLessThanOrEqual(rowMetrics.transaction.icon);
    expect(rowMetrics.transaction.height).toBe(64);
  });

  it('le contenu textuel fixe la hauteur d’une ligne de budget (plus haut que l’icône de 40 dp)', () => {
    expect(rowMetrics.budget.contentHeight).toBeGreaterThan(rowMetrics.budget.icon);
    expect(rowMetrics.budget.height).toBe(rowMetrics.budget.padding * 2 + rowMetrics.budget.contentHeight);
  });
});
