# Build context: repository root (see docker-compose.yml).
# Stage 1: the web app, exported as static files served by the API at "/".
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY apps/mobile/package.json apps/mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/mobile/ ./
# Empty API URL = same origin: the browser calls the server that served it.
ENV EXPO_PUBLIC_API_URL="" CI=1
RUN npx expo export --platform web

# Stage 2: compile the API.
FROM node:22-bookworm-slim AS api-build
WORKDIR /api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src
RUN npm run build && npm prune --omit=dev

# Stage 3: small runtime image, non-root.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-build /api/node_modules ./node_modules
COPY --from=api-build /api/dist ./dist
COPY --from=api-build /api/package.json ./
COPY --from=web /web/dist ./web
ENV WEB_DIR=/app/web PORT=3000 HOST=0.0.0.0
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
