# syntax=docker/dockerfile:1

# PawCare API development image. Local development only, not for deployment.
#
# The build context is the repository root, because the pnpm workspace and lockfile live there.
# Source code is not copied in: compose.yaml bind-mounts the repository so `nest start --watch`
# picks up your edits. See "Run the API in Docker" in README.md.

# Keep in step with .nvmrc.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS dev

# Prisma's CLI checks the OpenSSL version to choose its schema-engine binary.
# procps provides `ps`, which `nest start --watch` uses to stop the old server before a restart.
# Without it the old process keeps port 3000 and the restarted one fails with EADDRINUSE.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*

# pnpm comes from corepack, at the version pinned by "packageManager" in package.json.
# The store path is fixed because at runtime node_modules is a separate volume. Otherwise pnpm
# would choose a different store there, reinstall everything, and write it into the bind mount.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  npm_config_store_dir=/home/node/.pnpm-store
RUN corepack enable pnpm

WORKDIR /workspace
RUN chown node:node /workspace
USER node

# Copy only manifests, the lockfile and the Prisma schema (the API's postinstall runs
# `prisma generate`), so this layer is rebuilt only when dependencies change.
# apps/mobile/package.json is needed to match the workspace lockfile; its packages are not installed.
# packages/core is an API dependency; its `prepare` script compiles it during install, so its source is copied too.
# compose.yaml rebuilds it at start, because the bind mount hides this copy.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=node:node apps/mobile/package.json apps/mobile/
COPY --chown=node:node packages/core/package.json packages/core/tsconfig.json packages/core/tsconfig.build.json packages/core/
COPY --chown=node:node packages/core/src packages/core/src/
COPY --chown=node:node apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY --chown=node:node apps/api/prisma apps/api/prisma/
RUN pnpm install --frozen-lockfile --filter pawcare --filter "api..."

WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["pnpm", "start:dev"]
