# Build and dependency stages run on the builder's own CPU ($BUILDPLATFORM): the output is plain JavaScript
# (no native modules), so it is identical for amd64 and arm64 and nothing needs to run under QEMU emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Only the workspaces the server needs; the other apps' manifests are not required.
RUN npm ci -w @nial-infra/shared -w @nial-infra/server --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @nial-infra/shared && npm run build -w @nial-infra/server

FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci -w @nial-infra/shared -w @nial-infra/server --omit=dev --include-workspace-root=false && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
USER node
EXPOSE 5000
CMD ["node", "apps/server/dist/index.js"]
