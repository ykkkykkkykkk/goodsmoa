const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');
const { imageFileFilter, optionalAuth } = require('../middleware');
const { uploadToCloudinary } = require('../cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// ── 포카 포스트 목록 (필터 + 페이지네이션) ──
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { artist, album, rarity, q, page = 1, limit = 20 } = req.query;

    let where = '1=1';
    const params = [];

    if (artist) { where += ' AND c.artist = ?'; params.push(artist); }
    if (album) { where += ' AND c.album = ?'; params.push(album); }
    if (rarity) { where += ' AND c.rarity = ?'; params.push(parseInt(rarity)); }
    if (q) {
      where += ' AND (c.artist LIKE ? OR c.album LIKE ? OR c.version LIKE ? OR p.title LIKE ?)';
      const s = `%${q}%`;
      params.push(s, s, s, s);
    }

    const countRow = await db.get(
      `SELECT COUNT(DISTINCT c.id) as total FROM poca_cards c JOIN poca_posts p ON c.post_id = p.id WHERE ${where}`,
      params
    );
    const total = countRow.total;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const cards = await db.all(
      `SELECT c.*, p.title as post_title, p.user_id, u.nickname
       FROM poca_cards c
       JOIN poca_posts p ON c.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // 각 카드에 반응 수 붙이기
    const cardIds = cards.map(c => c.id);
    let reactions = [];
    if (cardIds.length > 0) {
      const placeholders = cardIds.map(() => '?').join(',');
      reactions = await db.all(
        `SELECT card_id, type, COUNT(*) as cnt FROM poca_reactions WHERE card_id IN (${placeholders}) GROUP BY card_id, type`,
        cardIds
      );
    }

    const reactionMap = {};
    for (const r of reactions) {
      if (!reactionMap[r.card_id]) reactionMap[r.card_id] = {};
      reactionMap[r.card_id][r.type] = r.cnt;
    }

    const data = cards.map(c => ({
      ...c,
      reactions: reactionMap[c.id] || {},
    }));

    res.json({
      ok: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// ── 포카 등록 (다중 이미지) ──
router.post('/', optionalAuth, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false, message: '로그인이 필요합니다' });

    const db = getDB();
    const { title, cards } = req.body;
    if (!title) return res.status(400).json({ ok: false, message: '제목을 입력하세요' });

    let cardData;
    try { cardData = JSON.parse(cards); } catch { return res.status(400).json({ ok: false, message: '카드 정보가 올바르지 않습니다' }); }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, message: '이미지를 1장 이상 업로드하세요' });
    }

    if (req.files.length !== cardData.length) {
      return res.status(400).json({ ok: false, message: '이미지 수와 카드 정보 수가 일치하지 않습니다' });
    }

    // 포스트 생성
    const postResult = await db.run(
      'INSERT INTO poca_posts (user_id, title) VALUES (?, ?)',
      [req.user.id, title]
    );
    const postId = postResult.lastInsertRowid || postResult.lastID;

    // 각 카드 업로드 + 저장
    for (let i = 0; i < req.files.length; i++) {
      const imageUrl = await uploadToCloudinary(req.files[i].buffer, 'goodsmoa/poca');
      const thumbnailUrl = imageUrl.replace('/upload/', '/upload/w_400,h_400,c_fill,q_80/');
      const c = cardData[i] || {};

      await db.run(
        'INSERT INTO poca_cards (post_id, image_url, thumbnail_url, artist, album, version, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [postId, imageUrl, thumbnailUrl, c.artist || '', c.album || '', c.version || '', parseInt(c.rarity) || 1]
      );
    }

    res.json({ ok: true, message: `${req.files.length}장 등록되었습니다` });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '등록 실패' });
  }
});

// ── 카드 상세 (댓글 + 반응 포함) ──
router.get('/cards/:id', async (req, res) => {
  try {
    const db = getDB();
    const card = await db.get(
      `SELECT c.*, p.title as post_title, p.user_id, u.nickname
       FROM poca_cards c
       JOIN poca_posts p ON c.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!card) return res.status(404).json({ ok: false, message: '카드를 찾을 수 없습니다' });

    const comments = await db.all(
      'SELECT * FROM poca_comments WHERE card_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    const reactions = await db.all(
      'SELECT type, COUNT(*) as cnt FROM poca_reactions WHERE card_id = ? GROUP BY type',
      [req.params.id]
    );

    const reactionMap = {};
    for (const r of reactions) reactionMap[r.type] = r.cnt;

    res.json({ ok: true, data: { ...card, comments, reactions: reactionMap } });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// ── 댓글 작성 ──
router.post('/cards/:id/comments', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false, message: '로그인이 필요합니다' });

    const db = getDB();
    const card = await db.get('SELECT id FROM poca_cards WHERE id = ?', [req.params.id]);
    if (!card) return res.status(404).json({ ok: false, message: '카드를 찾을 수 없습니다' });

    const { content, type } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ ok: false, message: '내용을 입력하세요' });

    const validTypes = ['comment', '부럽다', '교환해요', '나도있어요'];
    const commentType = validTypes.includes(type) ? type : 'comment';

    await db.run(
      'INSERT INTO poca_comments (card_id, user_id, nickname, content, type) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, req.user.nickname, content.trim(), commentType]
    );

    res.json({ ok: true, message: '댓글이 등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '댓글 등록 실패' });
  }
});

// ── 반응 토글 ──
router.post('/cards/:id/reactions', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false, message: '로그인이 필요합니다' });

    const db = getDB();
    const card = await db.get('SELECT id FROM poca_cards WHERE id = ?', [req.params.id]);
    if (!card) return res.status(404).json({ ok: false, message: '카드를 찾을 수 없습니다' });

    const { type } = req.body;
    const validTypes = ['부럽다', '교환해요', '나도있어요'];
    if (!validTypes.includes(type)) return res.status(400).json({ ok: false, message: '유효하지 않은 반응입니다' });

    // 이미 있으면 삭제 (토글), 없으면 추가
    const existing = await db.get(
      'SELECT id FROM poca_reactions WHERE card_id = ? AND user_id = ? AND type = ?',
      [req.params.id, req.user.id, type]
    );

    if (existing) {
      await db.run('DELETE FROM poca_reactions WHERE id = ?', [existing.id]);
      res.json({ ok: true, toggled: false, message: '반응을 취소했습니다' });
    } else {
      await db.run(
        'INSERT INTO poca_reactions (card_id, user_id, type) VALUES (?, ?, ?)',
        [req.params.id, req.user.id, type]
      );
      res.json({ ok: true, toggled: true, message: '반응을 남겼습니다' });
    }
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '반응 처리 실패' });
  }
});

// ── 유저 프로필 스탯 ──
router.get('/profile/:userId', async (req, res) => {
  try {
    const db = getDB();
    const userId = req.params.userId;

    const user = await db.get('SELECT id, nickname, created_at FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ ok: false, message: '유저를 찾을 수 없습니다' });

    const totalCards = await db.get(
      'SELECT COUNT(*) as cnt FROM poca_cards c JOIN poca_posts p ON c.post_id = p.id WHERE p.user_id = ?',
      [userId]
    );
    const ssrCards = await db.get(
      'SELECT COUNT(*) as cnt FROM poca_cards c JOIN poca_posts p ON c.post_id = p.id WHERE p.user_id = ? AND c.rarity >= 4',
      [userId]
    );
    const exchangeDone = await db.get(
      "SELECT COUNT(*) as cnt FROM exchanges WHERE user_id = ? AND status = 'completed'",
      [userId]
    );

    res.json({
      ok: true,
      data: {
        ...user,
        totalCards: totalCards.cnt,
        ssrCards: ssrCards.cnt,
        exchangeDone: exchangeDone.cnt,
      },
    });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '프로필 조회 실패' });
  }
});

// ── 카드 삭제 (본인만) ──
router.delete('/cards/:id', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false, message: '로그인이 필요합니다' });

    const db = getDB();
    const card = await db.get(
      'SELECT c.id, p.user_id FROM poca_cards c JOIN poca_posts p ON c.post_id = p.id WHERE c.id = ?',
      [req.params.id]
    );
    if (!card) return res.status(404).json({ ok: false, message: '카드를 찾을 수 없습니다' });
    if (card.user_id !== req.user.id) return res.status(403).json({ ok: false, message: '본인의 카드만 삭제할 수 있습니다' });

    await db.run('DELETE FROM poca_comments WHERE card_id = ?', [req.params.id]);
    await db.run('DELETE FROM poca_reactions WHERE card_id = ?', [req.params.id]);
    await db.run('DELETE FROM poca_cards WHERE id = ?', [req.params.id]);

    res.json({ ok: true, message: '삭제되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '삭제 실패' });
  }
});

module.exports = router;
