# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_* vars are baked into the JS bundle at build time
ARG VITE_WEBHOOK_AUTHORITIES
ARG VITE_WEBHOOK_HOSPITALITY
ENV VITE_WEBHOOK_AUTHORITIES=$VITE_WEBHOOK_AUTHORITIES
ENV VITE_WEBHOOK_HOSPITALITY=$VITE_WEBHOOK_HOSPITALITY

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
