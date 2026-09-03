import { Injectable, BadRequestException } from '@nestjs/common';
import { DataProvider, DataProviderResult } from './data-provider.interface';
import { seedFromString, pick, intBetween } from './deterministic-random.util';

export interface RelativesQueryResult {
  documento: string;
  vinculosSimulados: { vinculo: string; nomeSimulado: string; mesmoEnderecoSimulado: boolean }[];
  aviso: string;
}

const VINCULOS = ['Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Irmão/Irmã'];

/**
 * Conector MOCK de vínculos familiares/parentesco — modo demonstração.
 *
 * ⚠️ Este é o conector mais sensível da plataforma do ponto de vista de
 * LGPD: um provedor real de "árvore de relacionamentos" cruza bases de
 * terceiros e só pode ser operado com base legal expressa (art. 7º LGPD —
 * tipicamente legítimo interesse para prevenção a fraude/análise de
 * crédito, com registro de finalidade). Esta implementação NÃO consulta
 * nenhuma base de dados real — gera vínculos fictícios e determinísticos
 * apenas para demonstrar o layout do produto. Trocar por um provedor real
 * (ex.: Big Data Corp, Assertiva) exige avaliação jurídica prévia.
 */
@Injectable()
export class RelativesConnector implements DataProvider<string, RelativesQueryResult> {
  async query(document: string): Promise<DataProviderResult<RelativesQueryResult>> {
    const digits = document.replace(/\D/g, '');
    if (digits.length !== 11) {
      throw new BadRequestException('Consulta de vínculos disponível apenas para CPF.');
    }
    const rng = seedFromString(digits);
    const count = intBetween(rng, 1, 4);

    const vinculos = Array.from({ length: count }).map((_, i) => ({
      vinculo: pick(rng, VINCULOS),
      nomeSimulado: `Vínculo Demonstrativo ${String.fromCharCode(65 + i)}`,
      mesmoEnderecoSimulado: rng() > 0.5,
    }));

    const data: RelativesQueryResult = {
      documento: digits,
      vinculosSimulados: vinculos,
      aviso:
        'Vínculos fictícios gerados apenas para demonstração do produto. Nenhuma base de dados pessoal real foi consultada. Em produção, este conector exige provedor licenciado e avaliação de base legal (LGPD art. 7º).',
    };

    return { provider: 'mock-demo', isDemoData: true, data };
  }
}
