# Stage 1: Build
FROM node:18-alpine AS build
RUN apk add --no-cache git
WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
COPY .git/ ./.git/
RUN VITE_APP_VERSION=$(git describe --tags --always) npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
