FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci -w @nial-infra/shared -w @nial-infra/web --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build:shared && npm run build -w @nial-infra/web

FROM nginx:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# nginx runs as an unprivileged user: whatever the file modes were in the build context, the site must be world-readable (else 403).
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
