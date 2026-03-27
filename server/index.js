require('dotenv').config();

// 운영 환경 필수 환경변수 검증 (로거 초기화 전이므로 console 사용)
if (process.env.NODE_ENV === 'production') {
  const required = ['ADMIN_PASSWORD', 'JWT_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[FATAL] 필수 환경변수 누락: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.ADMIN_PASSWORD === 'admin1234') {
    console.error('[FATAL] 운영 환경에서 기본 비밀번호(admin1234)를 사용할 수 없습니다.');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.includes('change')) {
    console.error('[FATAL] JWT_SECRET을 운영용으로 변경하세요.');
    process.exit(1);
  }
}

const logger = require('./logger');
const { initDB } = require('./db');

async function start() {
  await initDB();
  const app = require('./app');
  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    logger.info(`굿즈모아 서버 실행 중: http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  const shutdown = () => {
    logger.info('서버 종료 중...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(err => {
  logger.error('서버 시작 실패', { error: err.message, stack: err.stack });
  process.exit(1);
});
