import { CreditScoreConnector } from './credit-score.connector';

describe('CreditScoreConnector', () => {
  const connector = new CreditScoreConnector();

  it('é determinístico: o mesmo documento sempre gera o mesmo score', async () => {
    const first = await connector.query('12345678900');
    const second = await connector.query('12345678900');
    expect(first.data.scoreSimulado).toBe(second.data.scoreSimulado);
    expect(first.data.faixaSimulada).toBe(second.data.faixaSimulada);
  });

  it('gera scores diferentes para documentos diferentes (na prática)', async () => {
    const a = await connector.query('11111111111');
    const b = await connector.query('99999999999');
    expect(a.data.scoreSimulado).not.toBe(b.data.scoreSimulado);
  });

  it('marca sempre o resultado como dado de demonstração', async () => {
    const result = await connector.query('12345678900');
    expect(result.isDemoData).toBe(true);
    expect(result.provider).toBe('mock-demo');
  });

  it('mantém o score dentro da faixa 0–1000 e a faixa consistente', async () => {
    const result = await connector.query('98765432100');
    expect(result.data.scoreSimulado).toBeGreaterThanOrEqual(0);
    expect(result.data.scoreSimulado).toBeLessThanOrEqual(1000);
    expect(['ALTO RISCO', 'RISCO MÉDIO', 'BAIXO RISCO', 'EXCELENTE']).toContain(result.data.faixaSimulada);
  });
});
