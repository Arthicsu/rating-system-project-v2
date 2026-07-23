# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.17.0

ARG PNPM_VERSION=10.34.4

FROM node:${NODE_VERSION}-alpine AS base

ARG PNPM_VERSION

WORKDIR /usr/src/app

# Кэш corepack в общедоступном каталоге: pnpm подготавливается под root'ом,
# а runtime-стадия работает от пользователя node. Без этого corepack при старте
# контейнера не нашёл бы кэш в /root/.cache и полез бы качать pnpm из сети.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && [ "$(pnpm --version)" = "${PNPM_VERSION}" ]

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS source

COPY . .

FROM source AS check
RUN pnpm run lint && pnpm run typecheck && pnpm run check:api-sync

FROM source AS build

RUN pnpm run build

# Прод-зависимости отдельной стадией: runtime-у не нужны dev-пакеты
# (tailwind, eslint, типы, openapi-typescript), образ заметно легче.
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS final

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Приложение работает от штатного непривилегированного пользователя node:
# процессу веб-сервера права root в контейнере не нужны. chown обязателен,
# т.к. серверу нужна запись в .next/cache (оптимизация изображений).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc next.config.mjs ./
COPY --chown=node:node --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/.next ./.next
COPY --chown=node:node --from=build /usr/src/app/public ./public

RUN chown -R node:node ${COREPACK_HOME}
ENV COREPACK_ENABLE_NETWORK=0

USER node

# Expose the port that the application listens on.
EXPOSE 3000

CMD ["pnpm", "start"]
