#!/bin/sh
set -e

echo "=========================================================="
echo " Starting Antigravity WhatsApp Automation Backend"
echo " Environment: ${NODE_ENV:-development}"
echo "=========================================================="

# Executar migrações do Prisma automaticamente no deploy
if [ -n "$DATABASE_URL" ]; then
  echo "==> Sincronizando schema do banco de dados (Prisma Migrate Deploy)..."
  npx prisma migrate deploy || {
    echo "Aviso: Primeira tentativa falhou. Aguardando 3s e tentando novamente..."
    sleep 3
    npx prisma migrate deploy
  }

  echo "==> Verificando dados iniciais e seed demonstrativo..."
  node prisma/seed.js || npx prisma db seed || true
fi

echo "==> Iniciando processo NestJS: $@"
exec "$@"
