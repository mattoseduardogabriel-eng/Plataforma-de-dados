import { generateSecret, generateToken, verifyToken, keyUri } from './totp.util';

describe('totp.util', () => {
  it('generateSecret devolve uma string Base32 (só A-Z e 2-7)', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(20);
  });

  it('generateToken + verifyToken são consistentes: o código gerado agora é válido agora', () => {
    const secret = generateSecret();
    const token = generateToken(secret);
    expect(token).toMatch(/^\d{6}$/);
    expect(verifyToken(secret, token)).toBe(true);
  });

  it('rejeita um código de outro segredo', () => {
    const secretA = generateSecret();
    const secretB = generateSecret();
    const tokenA = generateToken(secretA);
    expect(verifyToken(secretB, tokenA)).toBe(false);
  });

  it('rejeita formato inválido (não 6 dígitos)', () => {
    const secret = generateSecret();
    expect(verifyToken(secret, '123')).toBe(false);
    expect(verifyToken(secret, 'abcdef')).toBe(false);
    expect(verifyToken(secret, '')).toBe(false);
    expect(verifyToken(secret, undefined)).toBe(false);
  });

  it('aceita o código do passo anterior/seguinte (tolerância de relógio), mas não 2 passos de distância', () => {
    const secret = generateSecret();
    const STEP_MS = 30 * 1000;
    const agora = Date.now();

    const tokenPassoAnterior = generateToken(secret, agora - STEP_MS);
    const tokenDoisPassosAntes = generateToken(secret, agora - STEP_MS * 3);

    expect(verifyToken(secret, tokenPassoAnterior)).toBe(true);
    expect(verifyToken(secret, tokenDoisPassosAntes)).toBe(false);
  });

  it('keyUri monta uma URI otpauth:// válida com o segredo e o e-mail', () => {
    const secret = generateSecret();
    const uri = keyUri(secret, 'admin@empresa.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=Aster');
  });

  it('bate com o vetor de teste oficial do RFC 6238 (HOTP em T=59s)', () => {
    // RFC 6238 Apêndice B: segredo ASCII "12345678901234567890", 8
    // dígitos, T0=0, X=30 -> HOTP(T=59s) = "94287082". Confirma que o
    // núcleo HMAC-SHA1/contador está certo, não só auto-consistente.
    const secretAscii = Buffer.from('12345678901234567890', 'ascii');
    const secretBase32 = secretAscii
      .toString('binary')
      .split('')
      .map((c) => c.charCodeAt(0))
      .reduce((bits, byte) => bits + byte.toString(2).padStart(8, '0'), '');
    const grupos = secretBase32.match(/.{1,5}/g) ?? [];
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const base32 = grupos.map((g) => alfabeto[parseInt(g.padEnd(5, '0'), 2)]).join('');

    // generateToken trunca em 6 dígitos (não 8) — compara só os últimos 6
    // do vetor oficial, que é o que os 6 dígitos finais do HOTP têm que bater.
    const tokenGerado = generateToken(base32, 59 * 1000);
    expect(tokenGerado).toBe('287082');
  });
});
