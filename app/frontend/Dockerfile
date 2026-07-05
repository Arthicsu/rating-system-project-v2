# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.17.0
# Версия pnpm зафиксирована ЖЁСТКО и совпадает с "packageManager" в package.json.
# Corepack гарантирует, что используется ровно она (никаких самообновлений на 11+,
# из-за которых образ на старте докачивал/пересобирал зависимости и съедал ОЗУ).
# Runtime-стадия pnpm НЕ использует вообще (CMD запускает next напрямую через node).
ARG PNPM_VERSION=10.34.4

FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

FROM deps AS devdeps

# devDependencies for lint/typecheck/build. Manifests are inherited from `deps`.
RUN pnpm install --frozen-lockfile

# Copy the rest of the source files into the image.
COPY . .

# Гейт качества: docker build --target check .
# (запускается отдельно, в цепочку до final не входит)
# check:api-sync следит, что lib/api-types.ts соответствует schema.yml;
# сам schema.yml обновляется вручную при изменении API backend:
#   docker compose exec -T backend python manage.py spectacular --file /shared/schema.yml
#   cp shared/schema.yml app/frontend/schema.yml && pnpm generate:api
FROM devdeps AS check
RUN pnpm run lint && pnpm run typecheck && pnpm run check:api-sync

FROM devdeps AS build

# Run the build script.
RUN pnpm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

# Use production node environment by default.
ENV NODE_ENV=production

# Copy package.json so that package manager commands can be used.

COPY package.json .npmrc pnpm-workspace.yaml ./

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/.next ./.next
COPY --from=build /usr/src/app/public ./public
COPY --from=build /usr/src/app/styles ./styles

# Expose the port that the application listens on.
EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
