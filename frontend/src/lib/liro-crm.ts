/**
 * Painel web do Liro CRM (interface do atendente, não a API externa).
 *
 * A URL do painel é fixa (`/painel`) independente do contato/conversa
 * aberta — é uma SPA sem deep-link por rota. Por isso, "abrir a conversa"
 * abre o painel numa aba nova e copia o telefone para a área de
 * transferência, para colar na busca ("Buscar por nome, telefone ou CNPJ").
 */
export const LIRO_CRM_PANEL_URL = 'https://webliro.com/painel';

export async function openLiroCrmConversation(phone: string | null | undefined): Promise<'copied' | 'no-phone'> {
  if (!phone) return 'no-phone';
  try {
    await navigator.clipboard.writeText(phone);
  } catch {
    // Clipboard pode falhar (permissão, contexto não seguro) — ainda assim abrimos o painel.
  }
  window.open(LIRO_CRM_PANEL_URL, '_blank', 'noopener,noreferrer');
  return 'copied';
}
