/**
 * Painel web do Liro CRM (interface do atendente, não a API externa).
 *
 * A URL do painel é fixa (`/painel`) independente do contato/conversa
 * aberta — é uma SPA sem deep-link por rota confirmado. Por isso, "abrir a
 * conversa" abre o painel e copia o telefone para a área de transferência,
 * para colar na busca ("Buscar por nome, telefone ou CNPJ").
 *
 * Best-effort: tentamos também passar o telefone como query param
 * (`?phone=`), caso o painel do Liro leia isso pra abrir a conversa direto
 * — não confirmado contra a aplicação real, é só uma tentativa que não tem
 * custo (se o Liro ignorar o parâmetro, cai no fluxo normal de colar na
 * busca). Se você confirmar o formato real de deep-link do Liro, troque a
 * query string abaixo pelo formato certo.
 */
export const LIRO_CRM_PANEL_URL = 'https://webliro.com/painel';

// Nome fixo da janela: reutiliza a MESMA aba/janela em cliques seguintes,
// em vez de abrir uma aba nova a cada clique (bug reportado — `'_blank'`
// como nome de janela sempre força uma aba nova; um nome fixo faz o
// navegador reaproveitar a mesma janela).
const LIRO_CRM_WINDOW_NAME = 'aster-liro-crm-panel';

export async function openLiroCrmConversation(phone: string | null | undefined): Promise<'copied' | 'no-phone'> {
  if (!phone) return 'no-phone';
  try {
    await navigator.clipboard.writeText(phone);
  } catch {
    // Clipboard pode falhar (permissão, contexto não seguro) — ainda assim abrimos o painel.
  }
  const digits = phone.replace(/\D/g, '');
  const url = digits ? `${LIRO_CRM_PANEL_URL}?phone=${digits}` : LIRO_CRM_PANEL_URL;
  const panelWindow = window.open(url, LIRO_CRM_WINDOW_NAME, 'noopener,noreferrer');
  // Se a janela já estava aberta em outra página do painel, força ela a
  // navegar pra URL com o telefone novo (e traz o foco pra ela).
  if (panelWindow) {
    try {
      panelWindow.location.href = url;
    } catch {
      // Cross-origin em navegação já existente — sem problema, já abriu.
    }
    panelWindow.focus();
  }
  return 'copied';
}
