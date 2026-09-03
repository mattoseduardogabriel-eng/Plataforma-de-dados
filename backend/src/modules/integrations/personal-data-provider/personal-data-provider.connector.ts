import { BadGatewayException, BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { DataProviderResult } from '../../data-intelligence/connectors/data-provider.interface';

export interface PersonalDataProviderCredentials {
  provider: string;
  baseUrl: string;
  apiKey: string;
  authHeaderName: string;
  authScheme: string;
}

export type PersonalDataQueryKind = 'cpf' | 'phone' | 'creditScore' | 'relatives';

/**
 * Conector GENÉRICO de dados pessoais (CPF/telefone/score/parentes) — chama
 * a API que a própria organização configurou (Serasa, Boa Vista, Big Data
 * Corp, Assertiva, Quod ou um endpoint próprio), em vez de um provedor fixo.
 *
 * Como cada bureau tem contrato de API diferente, este conector assume o
 * formato mais comum (GET num caminho com {documento} substituído, chave
 * num header) e devolve a resposta bruta do provedor — sem tentar adivinhar
 * o formato dela. Se a organização tiver a documentação real de um bureau
 * específico, o ideal é substituir esta implementação por um conector
 * dedicado (mesmo padrão do `LiroCrmConnector`), fiel ao contrato exato
 * daquele provedor.
 */
@Injectable()
export class PersonalDataProviderConnector {
  private readonly logger = new Logger(PersonalDataProviderConnector.name);

  constructor(private readonly httpService: HttpService) {}

  async query(
    creds: PersonalDataProviderCredentials,
    path: string,
    documento: string,
  ): Promise<DataProviderResult<Record<string, unknown>>> {
    const baseUrl = creds.baseUrl.replace(/\/+$/, '');
    const resolvedPath = path.replace('{documento}', encodeURIComponent(documento)).replace(/^\/?/, '/');
    const headerValue = creds.authScheme ? `${creds.authScheme} ${creds.apiKey}` : creds.apiKey;

    try {
      const { data } = await firstValueFrom(
        this.httpService.request<Record<string, unknown>>({
          method: 'get',
          url: `${baseUrl}${resolvedPath}`,
          timeout: 15000,
          headers: { [creds.authHeaderName]: headerValue },
        }),
      );
      return { provider: creds.provider.toLowerCase(), isDemoData: false, data };
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; error?: string }>;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.message ?? axiosError.response?.data?.error;

      if (status === 401 || status === 403) {
        throw new UnauthorizedException(message ?? 'Credencial rejeitada pelo provedor de dados configurado.');
      }
      if (status === 404) {
        throw new BadRequestException(message ?? 'Documento não encontrado no provedor configurado.');
      }
      if (status && status >= 400 && status < 500) {
        throw new BadRequestException(message ?? 'Requisição rejeitada pelo provedor de dados configurado.');
      }
      this.logger.error(`Falha ao chamar provedor de dados pessoais (${creds.provider}, GET ${resolvedPath}): ${axiosError.message}`);
      throw new BadGatewayException(
        'Não foi possível falar com o provedor de dados configurado no momento. Tente novamente em instantes.',
      );
    }
  }
}
