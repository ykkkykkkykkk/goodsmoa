const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');

// 아이돌 목록
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const idols = await db.all('SELECT * FROM idols ORDER BY name ASC');
    res.json({ ok: true, data: idols });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '아이돌 조회 실패' });
  }
});

// 아이돌 상세
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const idol = await db.get('SELECT * FROM idols WHERE id = ?', [req.params.id]);
    if (!idol) return res.status(404).json({ ok: false, message: '아이돌을 찾을 수 없습니다' });
    res.json({ ok: true, data: idol });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

module.exports = router;
