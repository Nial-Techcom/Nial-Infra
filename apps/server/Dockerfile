FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Only the workspaces the server needs; the other apps' manifests are not required.
RUN npm ci -w @infra-tech/shared -w @infra-tech/server --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @infra-tech/shared && npm run build -w @infra-tech/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci -w @infra-tech/shared -w @infra-tech/server --omit=dev --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
USER node
EXPOSE 5000
CMD ["node", "apps/server/dist/index.js"]
