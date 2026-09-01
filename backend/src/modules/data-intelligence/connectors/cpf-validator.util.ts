/** Validação do dígito verificador de CPF — algoritmo público, não consulta base nenhuma. */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calcCheckDigit = (base: string, factor: number) => {
    let total = 0;
    for (const char of base) {
      total += parseInt(char, 10) * factor;
      factor -= 1;
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstCheck = calcCheckDigit(digits.slice(0, 9), 10);
  const secondCheck = calcCheckDigit(digits.slice(0, 10), 11);

  return firstCheck === parseInt(digits[9], 10) && secondCheck === parseInt(digits[10], 10);
}

export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
