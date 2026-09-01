import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Cifra segredos de terceiros (ex.: chave de API do Liro CRM) antes de
 * gravar no banco, usando AES-256-GCM com a chave derivada de
 * `SECRET_ENCRYPTION_KEY` (.env). Nunca grave uma credencial de integração
 * em texto puro.
 */
@Injectable()
export class SecretCipher {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const raw = configService.get<string>('SECRET_ENCRYPTION_KEY');
    if (!raw) {
      throw new InternalServerErrorException(
        'SECRET_ENCRYPTION_KEY não configurada — necessária para guardar credenciais de integração com segurança.',
      );
    }
    // Deriva uma chave de 32 bytes a partir do valor configurado, qualquer
    // que seja seu tamanho original.
    this.key = createHash('sha256').update(raw).digest();
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, dataB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new InternalServerErrorException('Credencial armazenada em formato inválido.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /** Últimos 4 caracteres, para exibir "liro_...ab12" na UI sem expor a chave. */
  static maskSuffix(secret: string): string {
    return secret.slice(-4);
  }
}
