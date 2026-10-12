# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY server/package*.json ./

# ---- dev ----
FROM base AS dev
RUN npm ci
COPY server ./
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate:up && npm run dev"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY server ./
RUN npm run build

# ---- production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate:up && npm start"]