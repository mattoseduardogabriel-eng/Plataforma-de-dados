import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { UnauthorizedException, BadRequestException, BadGatewayException } from '@nestjs/common';
import { PersonalDataProviderConnector, PersonalDataProviderCredentials } from './personal-data-provider.connector';

function makeAxiosError(status: number, message?: string): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = {
    status,
    data: message ? { message } : {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

describe('PersonalDataProviderConnector', () => {
  const creds: PersonalDataProviderCredentials = {
    provider: 'GENERICO',
    baseUrl: 'https://api.provedor.com.br/v1',
    apiKey: 'chave-secreta',
    authHeaderName: 'X-Api-Key',
    authScheme: '',
  };

  it('monta a URL substituindo {documento} e usa o header/esquema configurados', async () => {
    const request = jest.fn().mockReturnValue(of({ data: { score: 700 } }));
    const connector = new PersonalDataProviderConnector({ request } as any);

    const result = await connector.query(creds, '/pessoas/{documento}/score', '11144477735');

    expect(result).toEqual({ provider: 'generico', isDemoData: false, data: { score: 700 } });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: `${creds.baseUrl}/pessoas/11144477735/score`,
        headers: { 'X-Api-Key': 'chave-secreta' },
      }),
    );
  });

  it('aplica o esquema (ex.: Bearer) antes da chave quando configurado', async () => {
    const request = jest.fn().mockReturnValue(of({ data: {} }));
    const connector = new PersonalDataProviderConnector({ request } as any);

    await connector.query({ ...creds, authHeaderName: 'Authorization', authScheme: 'Bearer' }, '/x/{documento}', '123');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: 'Bearer chave-secreta' } }),
    );
  });

  it('mapeia 401/403 para UnauthorizedException', async () => {
    const request = jest.fn().mockReturnValue(throwError(() => makeAxiosError(401)));
    const connector = new PersonalDataProviderConnector({ request } as any);

    await expect(connector.query(creds, '/x/{documento}', '123')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mapeia 404 para BadRequestException', async () => {
    const request = jest.fn().mockReturnValue(throwError(() => makeAxiosError(404)));
    const connector = new PersonalDataProviderConnector({ request } as any);

    await expect(connector.query(creds, '/x/{documento}', '123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mapeia falha de rede/5xx para BadGatewayException', async () => {
    const request = jest.fn().mockReturnValue(throwError(() => new AxiosError('timeout')));
    const connector = new PersonalDataProviderConnector({ request } as any);

    await expect(connector.query(creds, '/x/{documento}', '123')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
