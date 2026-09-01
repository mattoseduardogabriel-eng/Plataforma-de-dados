/**
 * Contrato comum de todo conector de dados da plataforma.
 *
 * Cada tipo de consulta (CNPJ, CPF, telefone, crédito, parentes) é resolvido
 * por uma implementação desta interface. Isso permite trocar um conector
 * mock por um provedor licenciado real (Serasa Experian, Boa Vista SCPC,
 * Big Data Corp, Assertiva, Quod, etc.) sem alterar controllers, DTOs ou o
 * restante da aplicação — basta implementar `DataProvider` apontando para a
 * API do provedor contratado e trocar o binding no módulo.
 */
export interface DataProviderResult<T = Record<string, unknown>> {
  /** Identificador do provedor que respondeu (ex.: "brasilapi", "mock-demo", "serasa-experian"). */
  provider: string;
  /** true quando o dado é simulado para fins de demonstração — nunca deve ser tratado como real. */
  isDemoData: boolean;
  /** Payload específico da consulta. */
  data: T;
}

export interface DataProvider<TInput = string, TOutput = Record<string, unknown>> {
  query(input: TInput): Promise<DataProviderResult<TOutput>>;
}
