# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.17.0
# Всё равно версия pnpm не подхватывается и используется последняя...
ARG PNPM_VERSION=11.9.0

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

FROM base as deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

FROM deps as build

# devDependencies for the production build. Manifests are inherited from `deps`.
RUN pnpm install --frozen-lockfile

# Copy the rest of the source files into the image.
COPY . .
# Run the build script.
RUN pnpm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base as final

# Use production node environment by default.
ENV NODE_ENV production

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
