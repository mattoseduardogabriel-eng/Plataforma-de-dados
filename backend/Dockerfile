FROM node:20-alpine AS builder
WORKDIR /app
# node:20-alpine não inclui OpenSSL, necessário pelo engine do Prisma — sem
# isso ele "adivinha" a versão (openssl-1.1.x) e pode falhar em runtime.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
RUN npm install --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
