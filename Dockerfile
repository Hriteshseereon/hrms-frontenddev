# Seereon HRMS web — production image (static React SPA served by nginx)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* values are baked in at build time
ARG VITE_API_BASE_URL
ARG VITE_DATA_MODE=mock
ARG VITE_APP_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_DATA_MODE=$VITE_DATA_MODE VITE_APP_URL=$VITE_APP_URL
RUN npm run build

FROM nginx:1.27-alpine AS run
# SPA fallback: every route serves index.html; static assets are cached hard.
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }\n\
  location / { try_files $uri $uri/ /index.html; }\n\
  add_header X-Content-Type-Options nosniff;\n\
  add_header Referrer-Policy strict-origin-when-cross-origin;\n\
  add_header Permissions-Policy "camera=(self), geolocation=(self), microphone=()";\n\
  add_header Content-Security-Policy "frame-ancestors '"'"'self'"'"' capacitor://localhost ionic://localhost http://localhost https://localhost; object-src '"'"'none'"'"'; base-uri '"'"'self'"'"'; form-action '"'"'self'"'"';";\n\
}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
