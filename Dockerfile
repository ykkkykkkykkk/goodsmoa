# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

# 서버 의존성 설치
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# 서버 소스
COPY server ./server

# 빌드된 프론트엔드 복사
COPY --from=frontend /app/dist ./dist

# 업로드 디렉토리 생성
RUN mkdir -p server/uploads/thumbs server/logs

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
