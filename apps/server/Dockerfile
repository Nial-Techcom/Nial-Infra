FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Only the workspaces the server needs; the other apps' manifests are not required.
RUN for i in 1 2 3; do npm ci -w @nial-infra/shared -w @nial-infra/server --include-workspace-root=false && break; [ "$i" = 3 ] && exit 1; echo "retry $i (emulated arm64 builds sometimes crash)"; sleep 5; done
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @nial-infra/shared && npm run build -w @nial-infra/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN for i in 1 2 3; do npm ci -w @nial-infra/shared -w @nial-infra/server --omit=dev --include-workspace-root=false && break; [ "$i" = 3 ] && exit 1; echo "retry $i (emulated arm64 builds sometimes crash)"; sleep 5; done && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
USER node
EXPOSE 5000
CMD ["node", "apps/server/dist/index.js"]
