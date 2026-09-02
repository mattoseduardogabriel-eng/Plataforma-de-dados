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

  async listContacts(
    creds: LiroCredentials,
    params: { since?: string; phoneNumber?: string; limit?: number } = {},
  ): Promise<LiroContact[]> {
    const raw = await this.request<unknown>(creds, 'get', '/contacts', { params });
    return this.unwrapList<LiroContact>(raw);
  }

  /**
   * APIs REST variam muito em como envelopam listas — algumas devolvem um
   * array puro, outras `{ data: [...] }`, `{ items: [...] }`,
   * `{ results: [...] }` ou uma página `{ contacts: [...] }`. Sem contrato
   * 100% confirmado contra o Liro real, aceitamos os formatos mais comuns
   * em vez de quebrar (ou pior, sincronizar silenciosamente 0 contatos)
   * quando a resposta não é um array puro.
   */
  private unwrapList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      for (const key of ['data', 'items', 'results', 'contacts', 'conversations']) {
        if (Array.isArray(obj[key])) return obj[key] as T[];
      }
    }
    this.logger.warn(
      `Resposta do Liro CRM não veio como array nem em um envelope conhecido (data/items/results) — ` +
        `verifique o formato real da API. Payload: ${JSON.stringify(raw).slice(0, 300)}`,
    );
    return [];
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

  async listTags(creds: LiroCredentials): Promise<LiroTag[]> {
    const raw = await this.request<unknown>(creds, 'get', '/tags');
    return this.unwrapList<LiroTag>(raw);
  }

  tagContact(creds: LiroCredentials, contactId: string, tagName: string) {
    return this.request<{ success: boolean }>(creds, 'post', `/contacts/${contactId}/tags`, {
      data: { tagName },
    });
  }

  async listConversations(
    creds: LiroCredentials,
    params: { since?: string; limit?: number } = {},
  ): Promise<LiroConversation[]> {
    const raw = await this.request<unknown>(creds, 'get', '/conversations', { params });
    return this.unwrapList<LiroConversation>(raw);
  }

  getConversation(creds: LiroCredentials, id: string) {
    return this.request<LiroConversation>(creds, 'get', `/conversations/${id}`);
  }
}
