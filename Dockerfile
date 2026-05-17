# Stage 1: Build Client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Stage 3: Final Production Image
FROM node:20-alpine
WORKDIR /app

# Copy server build and dependencies
COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/build ./server/build
COPY --from=server-build /app/server/public ./server/public

# Copy client build
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 2567

CMD ["node", "build/index.js"]
