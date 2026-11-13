FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci -w @infra-tech/shared -w @infra-tech/web --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build:shared && npm run build -w @infra-tech/web

FROM nginx:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
