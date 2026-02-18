FROM node:20-alpine AS base

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

FROM base AS dependencies

COPY package.json package-lock.json* ./

COPY prisma ./prisma

RUN npm ci --only=production && \
    npm cache clean --force

RUN cp -R node_modules /prod_node_modules

RUN npm ci

FROM base AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY biome.json* ./

COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate

RUN npm run build

FROM base AS production

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=dependencies /prod_node_modules ./node_modules

COPY --from=build /app/prisma ./prisma

COPY --from=build /app/dist ./dist

COPY --from=build /app/package.json ./

RUN npx prisma generate

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]
