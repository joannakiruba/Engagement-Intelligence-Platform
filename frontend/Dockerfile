FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite embeds VITE_* values in the public bundle. Set this in the Railway
# frontend service to the backend's public HTTPS URL.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Railway supplies PORT at runtime; keep 8080 as the local/container default.
ENV PORT=8080
EXPOSE 8080
