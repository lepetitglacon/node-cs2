# Stage 1: Build Client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
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
WORKDIR /app/server

# Copy everything from server build
COPY --from=server-build /app/server ./

# Explicitly copy public folder again to be 100% sure
COPY server/public ./public

# Copy client build
COPY --from=client-build /app/client/dist ../client/dist

ENV NODE_ENV=production
EXPOSE 2567

CMD ["node", "build/index.js"]
