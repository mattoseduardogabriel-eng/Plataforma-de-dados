-- Segredo (cifrado) usado pra validar a assinatura HMAC (X-Liro-Signature)
-- de cada entrega de webhook recebida do Liro CRM.
ALTER TABLE "Organization" ADD COLUMN "liroWebhookSigningSecretEncrypted" TEXT;
