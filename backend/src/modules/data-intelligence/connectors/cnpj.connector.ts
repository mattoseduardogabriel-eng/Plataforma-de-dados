import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { DataProvider, DataProviderResult } from './data-provider.interface';

export interface CnpjQueryResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  dataSituacaoCadastral: string | null;
  motivoSituacaoCadastral: string | null;
  dataInicioAtividade: string | null;
  naturezaJuridica: string | null;
  cnaePrincipal: { codigo: string | null; descricao: string | null };
  cnaesSecundarios: { codigo: string; descricao: string }[];
  capitalSocial: number | null;
  porte: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
  };
  socios: { nome: string; qualificacao: string | null; dataEntrada: string | null }[];
}

/**
 * Consulta de CNPJ via BrasilAPI — agregador público e gratuito de dados
 * oficiais da Receita Federal (situação cadastral, quadro societário, CNAE).
 * Não requer chave de API nem contrato: é dado público por definição legal.
 */
@Injectable()
export class CnpjConnector implements DataProvider<string, CnpjQueryResult> {
  private readonly logger = new Logger(CnpjConnector.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('CNPJ_PROVIDER_BASE_URL') ??
      'https://brasilapi.com.br/api/cnpj/v1';
  }

  async query(cnpj: string): Promise<DataProviderResult<CnpjQueryResult>> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${cleanCnpj}`, { timeout: 8000 }),
      );

      const result: CnpjQueryResult = {
        cnpj: data.cnpj,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || null,
        situacaoCadastral: data.descricao_situacao_cadastral,
        dataSituacaoCadastral: data.data_situacao_cadastral ?? null,
        motivoSituacaoCadastral: data.descricao_motivo_situacao_cadastral ?? null,
        dataInicioAtividade: data.data_inicio_atividade ?? null,
        naturezaJuridica: data.natureza_juridica ?? null,
        cnaePrincipal: {
          codigo: data.cnae_fiscal ? String(data.cnae_fiscal) : null,
          descricao: data.cnae_fiscal_descricao ?? null,
        },
        cnaesSecundarios: (data.cnaes_secundarios ?? []).map((c: any) => ({
          codigo: String(c.codigo),
          descricao: c.descricao,
        })),
        capitalSocial: data.capital_social ?? null,
        porte: data.porte ?? null,
        endereco: {
          logradouro: data.logradouro ?? null,
          numero: data.numero ?? null,
          bairro: data.bairro ?? null,
          municipio: data.municipio ?? null,
          uf: data.uf ?? null,
          cep: data.cep ?? null,
        },
        socios: (data.qsa ?? []).map((s: any) => ({
          nome: s.nome_socio,
          qualificacao: s.qualificacao_socio ?? null,
          dataEntrada: s.data_entrada_sociedade ?? null,
        })),
      };

      return { provider: 'brasilapi', isDemoData: false, data: result };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException('CNPJ não encontrado na base da Receita Federal.');
      }
      this.logger.error(`Falha ao consultar CNPJ ${cleanCnpj}: ${axiosError.message}`);
      throw new NotFoundException(
        'Não foi possível consultar o CNPJ no momento. Tente novamente em instantes.',
      );
    }
  }
}
