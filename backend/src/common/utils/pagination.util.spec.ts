import { normalizePagination } from './pagination.util';

describe('normalizePagination', () => {
  it('usa os padrões quando nada é informado', () => {
    expect(normalizePagination(undefined, undefined)).toEqual({ page: 1, pageSize: 25 });
  });

  it('usa o page/pageSize informado quando válido', () => {
    expect(normalizePagination(3, 10)).toEqual({ page: 3, pageSize: 10 });
  });

  it('trava o pageSize no máximo (100), mesmo pedindo mais', () => {
    expect(normalizePagination(1, 500)).toEqual({ page: 1, pageSize: 100 });
  });

  it('cai no padrão quando page/pageSize vêm inválidos (0, negativo, NaN)', () => {
    expect(normalizePagination(0, -5)).toEqual({ page: 1, pageSize: 25 });
    expect(normalizePagination(NaN, NaN)).toEqual({ page: 1, pageSize: 25 });
  });

  it('arredonda pra baixo quando vem fracionado', () => {
    expect(normalizePagination(2.9, 10.9)).toEqual({ page: 2, pageSize: 10 });
  });
});
