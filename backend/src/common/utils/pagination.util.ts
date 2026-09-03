// Paginação simples (offset/limit) pros endpoints de listagem que crescem
// sem limite (Leads, Clientes) — evita devolver a base inteira numa
// chamada só conforme a carteira/funil da empresa cresce. Não usar em
// listagens que alimentam um board inteiro de uma vez (ex.: Kanban de
// negócios), que precisam de todos os itens pra renderizar as colunas.
const PAGE_SIZE_PADRAO = 25;
const PAGE_SIZE_MAXIMO = 100;

export function normalizePagination(
  page?: number,
  pageSize?: number,
): { page: number; pageSize: number } {
  const paginaValida = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  const tamanhoValido =
    Number.isFinite(pageSize) && (pageSize as number) > 0
      ? Math.min(Math.floor(pageSize as number), PAGE_SIZE_MAXIMO)
      : PAGE_SIZE_PADRAO;
  return { page: paginaValida, pageSize: tamanhoValido };
}
