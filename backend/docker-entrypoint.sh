#!/bin/sh
# Aplica migrations pendentes e garante a organização de demonstração antes de
# subir a API — seguro rodar em todo boot: `prisma migrate deploy` só aplica
# migrations novas, e `prisma db seed` recria apenas a organização demo (por
# nome), sem tocar em outras organizações já cadastradas.
set -e

echo "→ Aplicando migrations..."
npx prisma migrate deploy

if [ "$SKIP_DEMO_SEED" != "true" ]; then
  echo "→ Populando dados de demonstração..."
  npx prisma db seed
fi

echo "→ Iniciando API..."
exec node dist/main.js
