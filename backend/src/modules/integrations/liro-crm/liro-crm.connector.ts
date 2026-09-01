import { BadGatewayException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface LiroContact {
  id: string;
  phoneNumber: string;
  name?: string | null;
  city?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  companyName?: string | null;
  [key: string]: unknown;
}

export interface LiroTag {
  id: string;
  name: string;
}

export interface LiroConversation {
  id: string;
  contact?: LiroContact;
  stage?: string;
  lastMessageAt?: string;
  [key: string]: unknown;
}

export interface UpsertLiroContactInput {
  phoneNumber: string;
  name?: string;
  city?: string;
  cnpj?: string | null;
  cpf?: string | null;
  companyName?: string;
}

export interface LiroCredentials {
  apiKey: string;
  baseUrl: string;
}

/**
 * Cliente HTTP fiel à "API externa do Liro CRM" (server-to-server, chave
 * `liro_<id>_<segredo>` no header Authorization). Ver
 * docs/INTEGRACAO-LIRO-CRM.md para o contrato completo.
 */
@Injectable()
export class LiroCrmConnector {
  private readonly logger = new Logger(LiroCrmConnector.name);

  constructor(private readonly httpService: HttpService) {}

  private async request<T>(
    creds: LiroCredentials,
    method: 'get' | 'post' | 'patch',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ): Promise<T> {
    const baseUrl = creds.baseUrl.replace(/\/+$/, '');
    try {
      const { data } = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: `${baseUrl}${path}`,
          params: options.params,
          data: options.data,
          timeout: 10000,
          headers: { Authorization: `Bearer ${creds.apiKey}` },
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.error;

      if (status === 401) {
        throw new UnauthorizedException(
          message ?? 'Chave de API do Liro CRM ausente, inválida ou revogada.',
        );
      }
      if (status === 404) {
        throw new NotFoundException(message ?? 'Recurso não encontrado no Liro CRM.');
      }
      if (status === 400) {
        throw new BadGatewayException(message ?? 'Requisição rejeitada pelo Liro CRM.');
      }
      this.logger.error(`Falha ao chamar Liro CRM (${method.toUpperCase()} ${path}): ${axiosError.message}`);
      throw new BadGatewayException('Não foi possível falar com o Liro CRM no momento.');
    }
  }

  listContacts(creds: LiroCredentials, params: { since?: string; phoneNumber?: string; limit?: number } = {}) {
    return this.request<LiroContact[]>(creds, 'get', '/contacts', { params });
  }

  getContact(creds: LiroCredentials, id: string) {
    return this.request<LiroContact>(creds, 'get', `/contacts/${id}`);
  }

  upsertContact(creds: LiroCredentials, input: UpsertLiroContactInput) {
    return this.request<LiroContact>(creds, 'post', '/contacts', { data: input });
  }

  patchContact(
    creds: LiroCredentials,
    id: string,
    input: Partial<Omit<UpsertLiroContactInput, 'phoneNumber'>>,
  ) {
    return this.request<LiroContact>(creds, 'patch', `/contacts/${id}`, { data: input });
  }

  listTags(creds: LiroCredentials) {
    return this.request<LiroTag[]>(creds, 'get', '/tags');
  }

  tagContact(creds: LiroCredentials, contactId: string, tagName: string) {
    return this.request<{ success: boolean }>(creds, 'post', `/contacts/${contactId}/tags`, {
      data: { tagName },
    });
  }

  listConversations(creds: LiroCredentials, params: { since?: string; limit?: number } = {}) {
    return this.request<LiroConversation[]>(creds, 'get', '/conversations', { params });
  }

  getConversation(creds: LiroCredentials, id: string) {
    return this.request<LiroConversation>(creds, 'get', `/conversations/${id}`);
  }
}
