# ============================================================================
# ESTÁGIO 1: BUILD DA APLICAÇÃO NESTJS
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Dependências nativas necessárias para o Prisma em Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copiar declaração de dependências do backend
COPY package.json ./

# Instalar todas as dependências necessárias para a compilação
RUN npm install

# Copiar schema do Prisma e gerar o cliente tipado
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar código-fonte da aplicação
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Compilar o backend NestJS
RUN npm run build

# Manter apenas as dependências de produção para a imagem final
RUN npm prune --omit=dev

# ============================================================================
# ESTÁGIO 2: RUNNER DE PRODUÇÃO
# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Dependências de runtime para o Prisma e script de entrypoint
RUN apk add --no-cache openssl libc6-compat bash

ENV NODE_ENV=production
ENV PORT=3000

# Criar usuário não-root com privilégios restritos
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

# Copiar artefatos compilados e dependências com chown direto (evita camada duplicada)
COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nestjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nestjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER nestjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
