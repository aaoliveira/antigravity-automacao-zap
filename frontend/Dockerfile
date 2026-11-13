# ============================================================================
# ESTÁGIO 1: DEPENDÊNCIAS E BUILD DO NEXT.JS (STANDALONE)
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copiar declaração de dependências do frontend
COPY package.json ./

# Instalar dependências completas
RUN npm install

# Copiar arquivos de configuração e código-fonte
COPY tsconfig*.json next.config.mjs tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src

# Variáveis e build arguments
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3000}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compilar Next.js no modo standalone
RUN npm run build

# ============================================================================
# ESTÁGIO 2: RUNNER STANDALONE DE PRODUÇÃO (LEVE E OTIMIZADO)
# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copiar assets estáticos
COPY --from=builder /app/public ./public

# Criar diretório .next
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar arquivos do standalone gerados no build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Script de inicialização para execução segura
RUN echo '#!/bin/sh' > /app/run.sh && \
    echo 'if [ -f server.js ]; then' >> /app/run.sh && \
    echo '  exec node server.js' >> /app/run.sh && \
    echo 'elif [ -f frontend/server.js ]; then' >> /app/run.sh && \
    echo '  exec node frontend/server.js' >> /app/run.sh && \
    echo 'else' >> /app/run.sh && \
    echo '  echo "Erro: server.js nao encontrado"; exit 1' >> /app/run.sh && \
    echo 'fi' >> /app/run.sh && \
    chmod +x /app/run.sh

USER nextjs

EXPOSE 3001

CMD ["/app/run.sh"]
