FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN if [ -f /app/frontend/package.json ]; then \
      cd /app/frontend && npm install && npm run build && cp -r dist /app/dist; \
    else \
      npm install && npm run build; \
    fi

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
