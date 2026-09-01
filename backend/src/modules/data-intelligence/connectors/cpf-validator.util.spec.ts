import { isValidCpf, formatCpf } from './cpf-validator.util';

describe('cpf-validator', () => {
  describe('isValidCpf', () => {
    it('aceita um CPF válido conhecido', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true);
      expect(isValidCpf('52998224725')).toBe(true);
    });

    it('rejeita CPF com dígito verificador inválido', () => {
      expect(isValidCpf('529.982.247-26')).toBe(false);
    });

    it('rejeita CPF com todos os dígitos iguais', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
    });

    it('rejeita CPF com tamanho incorreto', () => {
      expect(isValidCpf('123456')).toBe(false);
    });
  });

  describe('formatCpf', () => {
    it('formata os dígitos com máscara padrão', () => {
      expect(formatCpf('52998224725')).toBe('529.982.247-25');
    });
  });
});
