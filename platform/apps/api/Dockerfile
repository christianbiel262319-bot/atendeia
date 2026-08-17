FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate --workspace @atendeia/api
RUN npm run build --workspace @atendeia/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S atendeia && adduser -S atendeia -G atendeia

COPY --from=build --chown=atendeia:atendeia /app/package.json /app/package-lock.json ./
COPY --from=build --chown=atendeia:atendeia /app/node_modules ./node_modules
COPY --from=build --chown=atendeia:atendeia /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=atendeia:atendeia /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=atendeia:atendeia /app/apps/api/prisma ./apps/api/prisma

USER atendeia
EXPOSE 4000
CMD ["node", "apps/api/dist/src/server.js"]
