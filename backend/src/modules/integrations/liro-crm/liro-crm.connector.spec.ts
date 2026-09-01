import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { LiroCrmConnector } from './liro-crm.connector';

function makeAxiosError(status: number, error?: string): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = {
    status,
    data: error ? { error } : {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

describe('LiroCrmConnector', () => {
  const creds = { apiKey: 'liro_abc_123', baseUrl: 'https://app.lirocrm.com.br/api/external/v1' };

  it('envia o header Authorization Bearer e devolve os dados', async () => {
    const request = jest.fn().mockReturnValue(of({ data: [{ id: 't1', name: 'Risco alto' }] }));
    const connector = new LiroCrmConnector({ request } as any);

    const tags = await connector.listTags(creds);

    expect(tags).toEqual([{ id: 't1', name: 'Risco alto' }]);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: `${creds.baseUrl}/tags`,
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      }),
    );
  });

  it('faz upsert de contato via POST /contacts', async () => {
    const request = jest.fn().mockReturnValue(of({ data: { id: 'c1', phoneNumber: '5511999998888' } }));
    const connector = new LiroCrmConnector({ request } as any);

    const contact = await connector.upsertContact(creds, { phoneNumber: '5511999998888', name: 'Fulano' });

    expect(contact.id).toBe('c1');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'post', url: `${creds.baseUrl}/contacts` }),
    );
  });

  it('traduz 401 em UnauthorizedException', async () => {
    const request = jest.fn().mockReturnValue(throwError(() => makeAxiosError(401, 'chave revogada')));
    const connector = new LiroCrmConnector({ request } as any);

    await expect(connector.listTags(creds)).rejects.toThrow(UnauthorizedException);
  });

  it('traduz 404 em NotFoundException', async () => {
    const request = jest.fn().mockReturnValue(throwError(() => makeAxiosError(404, 'contato não existe')));
    const connector = new LiroCrmConnector({ request } as any);

    await expect(connector.getContact(creds, 'nope')).rejects.toThrow(NotFoundException);
  });
});
