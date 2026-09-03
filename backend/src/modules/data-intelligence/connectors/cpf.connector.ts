import { Injectable, BadRequestException } from '@nestjs/common';
import { DataProvider, DataProviderResult } from './data-provider.interface';
import { isValidCpf, formatCpf } from './cpf-validator.util';
import { seedFromString, pick } from './deterministic-random.util';

export interface CpfQueryResult {
  cpf: string;
  cpfValido: boolean;
  situacaoCadastralSimulada: string;
  nomeSimulado: string;
  faixaEtariaSimulada: string;
  regiaoSimulada: string;
  aviso: string;
}

const NOMES_DEMO = [
  'Titular Demonstrativo A',
  'Titular Demonstrativo B',
  'Titular Demonstrativo C',
  'Titular Demonstrativo D',
];
const SITUACOES = ['REGULAR', 'REGULAR', 'REGULAR', 'PENDENTE DE REGULARIZAÇÃO'];
const FAIXAS_ETARIAS = ['18-24', '25-34', '35-44', '45-59', '60+'];
const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

/**
 * Conector MOCK de CPF — modo demonstração.
 *
 * Valida o dígito verificador (algoritmo público) e devolve um dossiê
 * SINTÉTICO e determinístico (não corresponde a nenhuma pessoa real).
 * Para produção, implemente `DataProvider<string, CpfQueryResult>` contra
 * um provedor licenciado (Serasa, Boa Vista, Big Data Corp) com base legal
 * (LGPD art. 7º) para tratar dado pessoal de terceiros.
 */
@Injectable()
export class CpfConnector implements DataProvider<string, CpfQueryResult> {
  async query(cpf: string): Promise<DataProviderResult<CpfQueryResult>> {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      throw new BadRequestException('CPF deve conter 11 dígitos.');
    }
    const rng = seedFromString(digits);
    const valido = isValidCpf(digits);

    const data: CpfQueryResult = {
      cpf: formatCpf(digits),
      cpfValido: valido,
      situacaoCadastralSimulada: valido ? pick(rng, SITUACOES) : 'DÍGITO VERIFICADOR INVÁLIDO',
      nomeSimulado: pick(rng, NOMES_DEMO),
      faixaEtariaSimulada: pick(rng, FAIXAS_ETARIAS),
      regiaoSimulada: pick(rng, REGIOES),
      aviso:
        'Dados de demonstração gerados de forma sintética e determinística. Não representam pessoa real.',
    };

    return { provider: 'mock-demo', isDemoData: true, data };
  }
}
