import { Injectable, BadRequestException } from '@nestjs/common';
import { DataProvider, DataProviderResult } from './data-provider.interface';
import { seedFromString, pick } from './deterministic-random.util';

export interface PhoneQueryResult {
  telefone: string;
  ddd: string;
  ufSimulada: string;
  tipoSimulado: 'MÓVEL' | 'FIXO';
  operadoraSimulada: string;
  aviso: string;
}

// DDD → UF é informação pública (plano de numeração da Anatel), não dado pessoal.
const DDD_UF: Record<string, string> = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF', '62': 'GO', '64': 'GO', '63': 'TO',
  '65': 'MT', '66': 'MT', '67': 'MS',
  '68': 'AC', '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE', '81': 'PE', '87': 'PE',
  '82': 'AL', '83': 'PB', '84': 'RN', '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI', '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM', '95': 'RR', '96': 'AP', '98': 'MA', '99': 'MA',
};

const OPERADORAS_DEMO = ['Operadora Demo Alfa', 'Operadora Demo Beta', 'Operadora Demo Gama'];

/**
 * Conector MOCK de telefone — modo demonstração.
 * O DDD é interpretado com o plano de numeração público da Anatel (dado
 * público). Operadora e tipo de linha são simulados. Para dados reais de
 * portabilidade/titularidade, contrate um provedor licenciado.
 */
@Injectable()
export class PhoneConnector implements DataProvider<string, PhoneQueryResult> {
  async query(phone: string): Promise<DataProviderResult<PhoneQueryResult>> {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new BadRequestException('Telefone deve incluir DDD (10 ou 11 dígitos).');
    }
    const ddd = digits.slice(0, 2);
    const rng = seedFromString(digits);
    const isMobile = digits.length === 11;

    const data: PhoneQueryResult = {
      telefone: digits,
      ddd,
      ufSimulada: DDD_UF[ddd] ?? 'DESCONHECIDA',
      tipoSimulado: isMobile ? 'MÓVEL' : 'FIXO',
      operadoraSimulada: pick(rng, OPERADORAS_DEMO),
      aviso:
        'UF derivada do DDD (dado público). Operadora/tipo são simulados para demonstração.',
    };

    return { provider: 'mock-demo', isDemoData: true, data };
  }
}
