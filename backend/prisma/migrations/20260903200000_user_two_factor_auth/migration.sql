-- 2FA (TOTP): segredo cifrado + flag de habilitado (só vira true depois
-- de confirmar um código válido, ver TwoFactorController).
ALTER TABLE "users" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
