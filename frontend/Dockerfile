FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx:alpine gera /etc/nginx/conf.d/default.conf a partir deste template via
# envsubst no start, substituindo ${PORT} — necessário porque plataformas como
# Railway atribuem a porta dinamicamente (variável de ambiente PORT).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
