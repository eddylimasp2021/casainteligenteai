# =====================================================================
# Estágio 1: Build
# =====================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json tsconfig.json ./

# Instalar dependências completas para compilação
RUN npm install

# Copiar código-fonte
COPY src ./src

# Compilar TypeScript para JavaScript
RUN npm run build

# =====================================================================
# Estágio 2: Runtime de Produção
# =====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Configuração de segurança
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D gatewayuser

COPY package.json ./

# Instalar apenas dependências de produção
RUN npm install --omit=dev && npm cache clean --force

# Copiar build gerado no estágio anterior
COPY --from=builder /app/dist ./dist

# Ajustar permissões para usuário não privilegiado
RUN chown -R gatewayuser:nodejs /app

USER gatewayuser

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "dist/server.js"]
