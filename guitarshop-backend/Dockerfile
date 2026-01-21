FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY scripts ./scripts

# instala deps para Linux
RUN rm -f package-lock.json && npm install --no-audit --no-fund

COPY . .

# build-time envs (las pasaremos desde docker compose)
ARG JWT_SECRET
ARG DATABASE_URL
ENV JWT_SECRET=$JWT_SECRET
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production
ENV PORT=3000

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
