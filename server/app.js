const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const logger = require('./logger');
const { apiLimiter, sanitizeBody } = require('./middleware');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// 운영 환경 HTTPS 강제 리다이렉트 (리버스 프록시 뒤에서 동작)
if (isProd) {
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
}

// gzip 압축
app.use(compression({ threshold: 1024 }));

// 보안 헤더 (Helmet + CSP)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// CORS
const allowedOrigins = [];
if (!isProd) {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:3001');
}
if (process.env.ALLOWED_ORIGIN) {
  allowedOrigins.push(process.env.ALLOWED_ORIGIN);
}

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(sanitizeBody);

// 업로드 파일 - 1일 캐시
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  immutable: false,
}));

// 요청 로깅
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// API rate limit
app.use('/api', apiLimiter);

// Routes
app.use('/api/banners', require('./routes/banners'));
app.use('/api/idols', require('./routes/idols'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trades', require('./routes/trades'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '굿즈모아 서버 정상 동작 중' });
});

// 프론트엔드 정적 파일 서빙 - JS/CSS는 해시 포함이므로 1년 캐시
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath, {
  maxAge: '1y',
  immutable: true,
  index: false, // index.html은 캐시하지 않음
}));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distPath, 'index.html'));
});

// 404
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ ok: false, message: '허용되지 않은 접근입니다' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, message: '파일 크기가 5MB를 초과합니다' });
  }
  if (err.message && err.message.includes('이미지 파일만')) {
    return res.status(400).json({ ok: false, message: err.message });
  }
  logger.error('Unhandled error', { error: err.message, stack: err.stack, url: req.originalUrl });
  res.status(500).json({ ok: false, message: '서버 오류' });
});

module.exports = app;
