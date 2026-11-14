FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN for i in 1 2 3; do npm ci -w @nial-infra/shared -w @nial-infra/web --include-workspace-root=false && break; [ "$i" = 3 ] && exit 1; echo "retry $i (emulated arm64 builds sometimes crash)"; sleep 5; done
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build:shared && npm run build -w @nial-infra/web

FROM nginx:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
