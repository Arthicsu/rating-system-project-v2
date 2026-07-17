# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.17.0
# Версия pnpm зафиксирована ЖЁСТКО и совпадает с "packageManager" в package.json.
# Corepack гарантирует, что используется ровно она (никаких самообновлений на 11+,
# из-за которых образ на старте докачивал/пересобирал зависимости и съедал ОЗУ).
ARG PNPM_VERSION=10.34.4

FROM node:${NODE_VERSION}-alpine AS base

# ARG, объявленный до первого FROM, внутри стадий пуст - его нужно
# передекларировать. Без этого prepare выполнялся как "pnpm@" и кэшировал
# в образ последнюю версию вместо запиненной.
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

################################################################################
# Финальная стадия: next запускается через pnpm. На pnpm 10.34.4 "pnpm start"
# на прод-сервере ведёт себя спокойно: зависимости на старте не проверяет и не
# переустанавливает (в отличие от 11.x, из-за которого раньше уходили на
# запуск standalone-сервера напрямую). Установка выполняется только на
# build-стадиях, runtime лишь запускает готовый .next.
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

# Кэш corepack отдаём node: corepack пишет туда служебные файлы при каждом
# запуске. Сеть ему запрещаем совсем - pnpm обязан браться из кэша образа,
# любая попытка докачки на старте контейнера должна падать сразу, а не
# съедать ОЗУ прод-сервера.
RUN chown -R node:node ${COREPACK_HOME}
ENV COREPACK_ENABLE_NETWORK=0

USER node

# Expose the port that the application listens on.
EXPOSE 3000

CMD ["pnpm", "start"]
