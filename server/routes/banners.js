const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');

// 배너 목록 (필터: idol, category)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { idol, category } = req.query;
    let sql = 'SELECT * FROM banners WHERE 1=1';
    const params = [];

    if (idol) {
      sql += " AND (idol = ? OR idol = '전체 아이돌')";
      params.push(idol);
    }
    if (category && category !== '전체') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';
    const banners = await db.all(sql, params);
    res.json({ ok: true, data: banners });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '배너 조회 실패' });
  }
});

// 최근 등록 배너 (제보 목록용) — /:id 보다 먼저 선언해야 함
router.get('/recent/list', async (req, res) => {
  try {
    const db = getDB();
    const banners = await db.all(
      'SELECT id, shop_name, idol, category, created_at FROM banners ORDER BY created_at DESC LIMIT 10'
    );
    res.json({ ok: true, data: banners });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// 배너 상세
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const banner = await db.get('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (!banner) return res.status(404).json({ ok: false, message: '배너를 찾을 수 없습니다' });
    res.json({ ok: true, data: banner });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '배너 조회 실패' });
  }
});

module.exports = router;
