FROM node:23-alpine AS build

RUN apk add --no-cache tzdata && \
  cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime && \
  echo "Asia/Tokyo" > /etc/timezone

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

CMD ["node", "dist/index.js"]
