FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

RUN rm -f package-lock.json && npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
