import { Injectable } from '@nestjs/common';
import { DataProvider, DataProviderResult } from './data-provider.interface';
import { seedFromString, pick, intBetween } from './deterministic-random.util';

export interface CreditScoreQueryResult {
  documento: string;
  scoreSimulado: number;
  faixaSimulada: 'ALTO RISCO' | 'RISCO MÉDIO' | 'BAIXO RISCO' | 'EXCELENTE';
  pendenciasSimuladas: number;
  recomendacaoSimulada: string;
  aviso: string;
}

/**
 * Conector MOCK de score de crédito — modo demonstração.
 *
 * Gera um score sintético e determinístico (0–1000, mesma escala usada por
 * bureaus como Serasa) a partir do documento consultado, sem consultar
 * nenhuma base real. Para produção, implemente `DataProvider` contra um
 * bureau de crédito licenciado (Serasa Experian, Boa Vista SCPC, Quod).
 */
@Injectable()
export class CreditScoreConnector implements DataProvider<string, CreditScoreQueryResult> {
  async query(document: string): Promise<DataProviderResult<CreditScoreQueryResult>> {
    const digits = document.replace(/\D/g, '');
    const rng = seedFromString(digits);
    const score = intBetween(rng, 0, 1000);
    const pendencias = score < 400 ? intBetween(rng, 1, 5) : 0;

    const faixa: CreditScoreQueryResult['faixaSimulada'] =
      score < 300 ? 'ALTO RISCO' : score < 600 ? 'RISCO MÉDIO' : score < 850 ? 'BAIXO RISCO' : 'EXCELENTE';

    const recomendacoes: Record<CreditScoreQueryResult['faixaSimulada'], string> = {
      'ALTO RISCO': 'Recomenda-se garantias adicionais ou análise manual antes de aprovar crédito.',
      'RISCO MÉDIO': 'Aprovação possível com limite de crédito conservador.',
      'BAIXO RISCO': 'Bom histórico simulado — condições padrão de crédito.',
      EXCELENTE: 'Excelente histórico simulado — elegível a condições especiais.',
    };

    const data: CreditScoreQueryResult = {
      documento: digits,
      scoreSimulado: score,
      faixaSimulada: faixa,
      pendenciasSimuladas: pendencias,
      recomendacaoSimulada: recomendacoes[faixa],
      aviso:
        'Score sintético gerado para demonstração — não reflete o histórico de crédito real do documento informado.',
    };

    return { provider: 'mock-demo', isDemoData: true, data };
  }
}
