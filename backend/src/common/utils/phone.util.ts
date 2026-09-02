/**
 * Normaliza telefone pro padrão único usado em toda a integração com o
 * Liro CRM (mesma lógica espelhada lá — ver liro-backend/src/utils/phone.js
 * no repositório do Liro) — sem isso, a mesma pessoa com o número salvo
 * de formas diferentes (com/sem +55, com/sem o 9º dígito, com
 * parênteses/traço) virava dois leads diferentes em vez de um só.
 *
 * Padrão: DDI 55 fixo + DDD (2 dígitos) + número (9 dígitos, com o 9 na
 * frente pra celular) = 13 dígitos, sempre.
 *
 * Heurística pro 9º dígito ausente: celular brasileiro sempre começa com
 * 6, 7, 8 ou 9 depois do DDD; fixo começa com 2 a 5. Um número de 10
 * dígitos (DDD + 8) que começa com 6-9 é celular sem o 9 — insere. Um de
 * 10 dígitos começando com 2-5 é fixo mesmo, não mexe.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return raw;

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[6-9]/.test(numero)) {
      digits = ddd + '9' + numero;
    }
  }

  return `55${digits}`;
}
