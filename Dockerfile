FROM node:20-alpine AS base_env

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# COPY package.json pnpm-lock.yaml ./
RUN --mount=type=bind,source=/package.json,target=/app/package.json \
    --mount=type=bind,source=/pnpm-lock.yaml,target=/app/pnpm-lock.yaml \
    pnpm install --frozen-lockfile

FROM base_env AS builder

COPY . .
RUN pnpm run build

FROM nginx:alpine AS prod

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
