const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev_only_secret');

// JWT 토큰 생성
function signToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '4h' });
}

// JWT 토큰 검증 미들웨어
function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: '인증이 필요합니다' });
  }
  try {
    jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: '토큰이 만료되었거나 유효하지 않습니다' });
  }
}

// 로그인 Rate Limit (15분 내 10회)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, message: '너무 많은 로그인 시도입니다. 15분 후 다시 시도하세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 일반 API Rate Limit (1분 100회)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 이미지 파일 필터
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMES.includes(file.mimetype) && ALLOWED_EXTS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp)'), false);
  }
}

// UUID 기반 랜덤 파일명 생성
function randomFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return crypto.randomUUID() + ext;
}

// XSS sanitize - 모든 HTML 태그 제거, 텍스트만 남김
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim();
}

// req.body의 문자열 필드를 일괄 sanitize하는 미들웨어
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string' && key !== 'password') {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }
  next();
}

module.exports = {
  JWT_SECRET,
  signToken,
  authAdmin,
  loginLimiter,
  apiLimiter,
  imageFileFilter,
  randomFilename,
  sanitize,
  sanitizeBody,
};
