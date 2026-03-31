const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');
const { authAdmin, signToken, loginLimiter, imageFileFilter } = require('../middleware');
const { uploadToCloudinary } = require('../cloudinary');

// 업로드 설정 (메모리 스토리지 → Cloudinary 업로드)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// 비밀번호 해시 (서버 시작 시 1회 생성하여 캐시)
let hashedPassword = null;
function getHashedPassword() {
  if (!hashedPassword) {
    const raw = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'admin1234');
    hashedPassword = bcrypt.hashSync(raw, 10);
  }
  return hashedPassword;
}

// 로그인 → JWT 토큰 발급
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  const match = bcrypt.compareSync(password || '', getHashedPassword());
  if (match) {
    res.json({ ok: true, token: signToken() });
  } else {
    res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다' });
  }
});

// ── 배너 CRUD (관리자 전용) ──

router.post('/banners', authAdmin, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { shop_name, url, idol, category } = req.body;
    let image_url = req.body.image_url || '';
    if (req.file) {
      image_url = await uploadToCloudinary(req.file.buffer, 'goodsmoa/banners');
    }

    await db.run(
      'INSERT INTO banners (shop_name, url, image_url, idol, category) VALUES (?, ?, ?, ?, ?)',
      [shop_name, url, image_url, idol, category || '전체']
    );
    res.json({ ok: true, message: '배너가 등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '배너 등록 실패' });
  }
});

router.put('/banners/:id', authAdmin, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { shop_name, url, idol, category, sort_order } = req.body;
    const existing = await db.get('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, message: '배너를 찾을 수 없습니다' });

    let image_url = req.body.image_url || existing.image_url;
    if (req.file) {
      image_url = await uploadToCloudinary(req.file.buffer, 'goodsmoa/banners');
    }

    await db.run(
      `UPDATE banners SET shop_name=?, url=?, image_url=?, idol=?, category=?, sort_order=? WHERE id=?`,
      [shop_name, url, image_url, idol, category, sort_order || 0, req.params.id]
    );
    res.json({ ok: true, message: '배너가 수정되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '배너 수정 실패' });
  }
});

router.delete('/banners/:id', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    await db.run('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '배너가 삭제되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '배너 삭제 실패' });
  }
});

// ── 아이돌 CRUD (관리자 전용) ──

router.post('/idols', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { name, color, debut, agency } = req.body;
    await db.run(
      'INSERT INTO idols (name, color, debut, agency) VALUES (?, ?, ?, ?)',
      [name, color || '#000000', debut || '', agency || '']
    );
    res.json({ ok: true, message: '아이돌이 등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '아이돌 등록 실패' });
  }
});

router.delete('/idols/:id', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    await db.run('DELETE FROM idols WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '아이돌이 삭제되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '아이돌 삭제 실패' });
  }
});

// ── 제보 (공개) → reports 테이블에 pending 상태로 저장 ──

router.post('/report', upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { shop_name, url, idol, category } = req.body;
    let image_url = req.body.image_url || '';
    if (req.file) {
      image_url = await uploadToCloudinary(req.file.buffer, 'goodsmoa/reports');
    }

    await db.run(
      'INSERT INTO reports (shop_name, url, image_url, idol, category) VALUES (?, ?, ?, ?, ?)',
      [shop_name, url, image_url, idol, category || '온라인몰']
    );
    res.json({ ok: true, message: '제보가 접수되었습니다. 관리자 승인 후 반영됩니다.' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '제보 접수 실패' });
  }
});

// ── 제보 관리 (관리자 전용) ──

router.get('/reports', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status } = req.query;
    let sql = 'SELECT * FROM reports';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const reports = await db.all(sql, params);
    res.json({ ok: true, data: reports });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '제보 조회 실패' });
  }
});

// 제보 승인 → banners 테이블로 이동
router.post('/reports/:id/approve', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const report = await db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!report) return res.status(404).json({ ok: false, message: '제보를 찾을 수 없습니다' });

    await db.run(
      'INSERT INTO banners (shop_name, url, image_url, idol, category) VALUES (?, ?, ?, ?, ?)',
      [report.shop_name, report.url, report.image_url, report.idol, report.category]
    );
    await db.run('UPDATE reports SET status = ? WHERE id = ?', ['approved', req.params.id]);
    res.json({ ok: true, message: '제보가 승인되어 배너로 등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '승인 실패' });
  }
});

// 제보 거절
router.post('/reports/:id/reject', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    await db.run('UPDATE reports SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    res.json({ ok: true, message: '제보가 거절되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '거절 실패' });
  }
});

// ── 통계 (관리자 전용) ──

router.get('/stats', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const [bannerCount, exchangeCount, exchangeActive, exchangeCompleted, reportPending, tradeReportPending, idolStats, userCount, viewsToday, viewsTotal, uniqueToday, viewsByPage] = await Promise.all([
      db.get('SELECT COUNT(*) as cnt FROM banners'),
      db.get('SELECT COUNT(*) as cnt FROM exchanges'),
      db.get("SELECT COUNT(*) as cnt FROM exchanges WHERE status = 'exchanging'"),
      db.get("SELECT COUNT(*) as cnt FROM exchanges WHERE status = 'completed'"),
      db.get("SELECT COUNT(*) as cnt FROM reports WHERE status = 'pending'"),
      db.get("SELECT COUNT(*) as cnt FROM trade_reports WHERE status = 'pending'"),
      db.all("SELECT idol, COUNT(*) as cnt FROM exchanges GROUP BY idol ORDER BY cnt DESC LIMIT 10"),
      db.get('SELECT COUNT(*) as cnt FROM users'),
      db.get("SELECT COUNT(*) as cnt FROM page_views WHERE created_at >= date('now')"),
      db.get('SELECT COUNT(*) as cnt FROM page_views'),
      db.get("SELECT COUNT(DISTINCT ip) as cnt FROM page_views WHERE created_at >= date('now')"),
      db.all("SELECT page, COUNT(*) as cnt FROM page_views WHERE created_at >= date('now') GROUP BY page ORDER BY cnt DESC"),
    ]);
    res.json({
      ok: true,
      data: {
        banners: bannerCount.cnt,
        exchanges: { total: exchangeCount.cnt, exchanging: exchangeActive.cnt, completed: exchangeCompleted.cnt },
        pendingReports: reportPending.cnt,
        pendingTradeReports: tradeReportPending.cnt,
        topIdols: idolStats,
        users: userCount.cnt,
        views: {
          today: viewsToday.cnt,
          total: viewsTotal.cnt,
          uniqueToday: uniqueToday.cnt,
          byPage: viewsByPage,
        },
      },
    });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '통계 조회 실패' });
  }
});

// ── 거래글 신고 관리 (관리자 전용) ──

router.get('/trade-reports', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status } = req.query;
    let sql = `SELECT tr.*, e.idol as trade_idol, e.member as trade_member
               FROM trade_reports tr
               LEFT JOIN exchanges e ON tr.trade_id = e.id`;
    const params = [];
    if (status) {
      sql += ' WHERE tr.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY tr.created_at DESC';
    const reports = await db.all(sql, params);
    res.json({ ok: true, data: reports });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '신고 조회 실패' });
  }
});

// 신고 처리 (해결/무시)
router.post('/trade-reports/:id/resolve', authAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { action } = req.body; // 'resolved' or 'dismissed'
    if (!['resolved', 'dismissed'].includes(action)) {
      return res.status(400).json({ ok: false, message: '유효하지 않은 액션입니다' });
    }
    await db.run('UPDATE trade_reports SET status = ? WHERE id = ?', [action, req.params.id]);

    // resolved일 경우 해당 거래글도 삭제 옵션
    if (action === 'resolved' && req.body.deleteTrade) {
      const report = await db.get('SELECT trade_id FROM trade_reports WHERE id = ?', [req.params.id]);
      if (report) {
        await db.run('DELETE FROM exchanges WHERE id = ?', [report.trade_id]);
      }
    }
    res.json({ ok: true, message: action === 'resolved' ? '신고가 처리되었습니다' : '신고가 무시되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '처리 실패' });
  }
});

module.exports = router;
