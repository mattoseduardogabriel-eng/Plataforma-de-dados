import { createHmac, randomBytes } from 'crypto';

// TOTP (RFC 6238) implementado só com o módulo `crypto` nativo do Node —
// sem dependência nova (a mesma conta do Google Authenticator/Authy
// funciona normal, o algoritmo é padrão de mercado). Núcleo HOTP
// verificado contra o vetor de teste oficial do RFC (ver totp.util.spec.ts).

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30; // janela padrão de 30s
const DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');

  let saida = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    saida += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const resto = bits.length % 5;
  if (resto) {
    const ultimoGrupo = bits.slice(bits.length - resto).padEnd(5, '0');
    saida += BASE32_ALPHABET[parseInt(ultimoGrupo, 2)];
  }
  return saida;
}

function base32Decode(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of limpo) {
    const valor = BASE32_ALPHABET.indexOf(char);
    if (valor === -1) continue;
    bits += valor.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// Segredo de 20 bytes (160 bits — recomendação padrão do RFC pra HMAC-SHA1),
// codificado em Base32 pra caber no formato que todo app autenticador espera.
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codigo =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(codigo % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function generateToken(base32Secret: string, atTimeMs: number = Date.now()): string {
  const counter = Math.floor(atTimeMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// Aceita o código de 1 passo antes/depois do atual (±30s) pra tolerar
// relógio do celular levemente dessincronizado — sem isso, um segundo de
// atraso na digitação já rejeitava um código válido.
export function verifyToken(base32Secret: string, token: string | undefined, window = 1): boolean {
  if (!token || !/^\d{6}$/.test(token)) return false;
  const counterAtual = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const secretBuffer = base32Decode(base32Secret);

  for (let i = -window; i <= window; i++) {
    if (hotp(secretBuffer, counterAtual + i) === token) return true;
  }
  return false;
}

// otpauth:// URI padrão — o que vira o QR code que o app autenticador lê.
export function keyUri(base32Secret: string, accountLabel: string, issuer = 'Aster'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
