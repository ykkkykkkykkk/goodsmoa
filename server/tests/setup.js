// 테스트용 환경변수
process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'testpass1234';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing';
process.env.PORT = '0';

// CJS 모듈의 initDB를 직접 호출
const { initDB } = require('../db');
await initDB();
