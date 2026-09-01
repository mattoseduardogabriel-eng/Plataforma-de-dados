import { createHash } from 'crypto';

/**
 * Gerador pseudo-aleatório determinístico (seed = hash do documento).
 * Garante que os conectores mock sempre devolvam o mesmo resultado
 * "sintético" para o mesmo CPF/CNPJ/telefone consultado, como um provedor
 * real faria — sem depender de nenhuma base de dados pessoal de verdade.
 */
export function seedFromString(input: string): () => number {
  let seed = parseInt(createHash('sha256').update(input).digest('hex').slice(0, 8), 16);
  return () => {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0xffffffff;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
