import { Module } from '@nestjs/common';
import { SecretCipher } from './secret-cipher';

@Module({
  providers: [SecretCipher],
  exports: [SecretCipher],
})
export class CryptoModule {}
