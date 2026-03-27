import { describe, it, expect } from 'vitest';
import request from 'supertest';

// setup.js에서 이미 initDB() 완료. CJS app을 가져옴
const app = require('../app');

// Helper
async function getToken() {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ password: 'testpass1234' });
  return res.body.token;
}

// ── Health ──
describe('Health', () => {
  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Auth ──
describe('Admin Auth', () => {
  it('로그인 성공 → JWT 토큰 반환', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ password: 'testpass1234' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  it('잘못된 비밀번호 → 401', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('토큰 없이 관리자 API → 401', async () => {
    const res = await request(app).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });
});

// ── Idols ──
describe('Idols', () => {
  it('GET /api/idols → 아이돌 목록', async () => {
    const res = await request(app).get('/api/idols');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('관리자: 아이돌 등록 + 삭제', async () => {
    const token = await getToken();

    let res = await request(app)
      .post('/api/admin/idols')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '테스트그룹', color: '#FF0000', debut: '2025-01-01', agency: '테스트엔터' });
    expect(res.body.ok).toBe(true);

    res = await request(app).get('/api/idols');
    const idol = res.body.data.find(i => i.name === '테스트그룹');
    expect(idol).toBeTruthy();

    res = await request(app)
      .delete(`/api/admin/idols/${idol.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
  });
});

// ── Banners ──
describe('Banners', () => {
  it('GET /api/banners → 배너 목록', async () => {
    const res = await request(app).get('/api/banners');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('관리자: 배너 CRUD', async () => {
    const token = await getToken();

    let res = await request(app)
      .post('/api/admin/banners')
      .set('Authorization', `Bearer ${token}`)
      .field('shop_name', '테스트샵')
      .field('url', 'https://example.com')
      .field('idol', '방탄소년단')
      .field('category', '온라인몰');
    expect(res.body.ok).toBe(true);

    res = await request(app).get('/api/banners');
    const banner = res.body.data.find(b => b.shop_name === '테스트샵');
    expect(banner).toBeTruthy();

    res = await request(app)
      .put(`/api/admin/banners/${banner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('shop_name', '테스트샵수정')
      .field('url', 'https://example.com/edited')
      .field('idol', '방탄소년단')
      .field('category', '공식샵');
    expect(res.body.ok).toBe(true);

    res = await request(app)
      .delete(`/api/admin/banners/${banner.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
  });
});

// ── Trades ──
describe('Trades', () => {
  let tradeId;

  it('거래글 등록 (비밀번호 필수)', async () => {
    const res = await request(app)
      .post('/api/trades')
      .field('title', '테스트 포카 양도')
      .field('description', '미개봉입니다')
      .field('idol', '방탄소년단')
      .field('price', '15000')
      .field('contact', '@test_twitter')
      .field('password', 'trade1234');
    expect(res.body.ok).toBe(true);
  });

  it('비밀번호 없이 등록 → 400', async () => {
    const res = await request(app)
      .post('/api/trades')
      .field('title', '테스트')
      .field('idol', '방탄소년단')
      .field('price', '1000')
      .field('contact', 'test');
    expect(res.status).toBe(400);
  });

  it('거래 목록 + 페이지네이션', async () => {
    const res = await request(app).get('/api/trades?page=1&limit=10');
    expect(res.body.ok).toBe(true);
    expect(res.body.pagination).toBeTruthy();
    expect(res.body.pagination.page).toBe(1);
    tradeId = res.body.data[0]?.id;
  });

  it('검색', async () => {
    const res = await request(app).get('/api/trades?q=포카');
    expect(res.body.ok).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('비밀번호 확인', async () => {
    if (!tradeId) return;
    let res = await request(app)
      .post(`/api/trades/${tradeId}/verify`)
      .send({ password: 'trade1234' });
    expect(res.body.ok).toBe(true);

    res = await request(app)
      .post(`/api/trades/${tradeId}/verify`)
      .send({ password: 'wrong' });
    expect(res.status).toBe(403);
  });

  it('비밀번호로 수정', async () => {
    if (!tradeId) return;
    const res = await request(app)
      .put(`/api/trades/${tradeId}`)
      .field('title', '수정된 포카 양도')
      .field('password', 'trade1234');
    expect(res.body.ok).toBe(true);
  });

  it('잘못된 비밀번호로 삭제 → 403', async () => {
    if (!tradeId) return;
    const res = await request(app)
      .delete(`/api/trades/${tradeId}`)
      .send({ password: 'wrong' });
    expect(res.status).toBe(403);
  });

  it('올바른 비밀번호로 삭제', async () => {
    if (!tradeId) return;
    const res = await request(app)
      .delete(`/api/trades/${tradeId}`)
      .send({ password: 'trade1234' });
    expect(res.body.ok).toBe(true);
  });
});

// ── Reports ──
describe('Reports', () => {
  it('제보 접수', async () => {
    const res = await request(app)
      .post('/api/admin/report')
      .field('shop_name', '테스트몰')
      .field('url', 'https://test-shop.com')
      .field('idol', '세븐틴')
      .field('category', '온라인몰');
    expect(res.body.ok).toBe(true);
  });

  it('관리자: 제보 승인', async () => {
    const token = await getToken();

    let res = await request(app)
      .get('/api/admin/reports?status=pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const reportId = res.body.data[0].id;
    res = await request(app)
      .post(`/api/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
  });
});

// ── Trade Reports ──
describe('Trade Reports', () => {
  it('거래글 신고 + 관리자 처리', async () => {
    // 거래글 생성
    await request(app)
      .post('/api/trades')
      .field('title', '신고테스트')
      .field('idol', '에스파')
      .field('price', '5000')
      .field('contact', 'test')
      .field('password', 'pass1234');

    const trades = await request(app).get('/api/trades');
    const tid = trades.body.data.find(t => t.title === '신고테스트')?.id;
    expect(tid).toBeTruthy();

    // 신고
    let res = await request(app)
      .post(`/api/trades/${tid}/report`)
      .send({ reason: '사기 의심', detail: '테스트 신고' });
    expect(res.body.ok).toBe(true);

    // 관리자 처리
    const token = await getToken();
    res = await request(app)
      .get('/api/admin/trade-reports?status=pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    res = await request(app)
      .post(`/api/admin/trade-reports/${res.body.data[0].id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'dismissed' });
    expect(res.body.ok).toBe(true);
  });
});

// ── Stats ──
describe('Stats', () => {
  it('관리자: 통계 조회', async () => {
    const token = await getToken();
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.banners).toBeDefined();
    expect(res.body.data.trades).toBeDefined();
  });
});

// ── Security ──
describe('Security', () => {
  it('Helmet 보안 헤더', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
  });

  it('API 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});
