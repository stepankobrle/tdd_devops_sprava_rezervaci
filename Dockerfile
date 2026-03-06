
FROM node:20-alpine AS builder

WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .
RUN npm run build


FROM node:20-alpine AS production

WORKDIR /app


RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev


COPY --chown=node:node --from=builder /app/dist ./dist


EXPOSE 3000


HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1


CMD ["node", "dist/main"]
