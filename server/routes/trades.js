const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');
const { imageFileFilter, optionalAuth } = require('../middleware');
const { uploadWithThumbnail } = require('../cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// 교환 목록 (필터 + 검색 + 페이지네이션)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { idol, status, member, q, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT id, idol, member, have_cards, want_cards, description, contact, image_url, thumbnail_url, status, user_id, nickname, created_at FROM exchanges WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM exchanges WHERE 1=1';
    const params = [];
    const countParams = [];

    if (idol) {
      sql += ' AND idol = ?';
      countSql += ' AND idol = ?';
      params.push(idol);
      countParams.push(idol);
    }
    if (status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (member) {
      sql += ' AND member = ?';
      countSql += ' AND member = ?';
      params.push(member);
      countParams.push(member);
    }
    if (q) {
      sql += ' AND (have_cards LIKE ? OR want_cards LIKE ? OR description LIKE ? OR member LIKE ?)';
      countSql += ' AND (have_cards LIKE ? OR want_cards LIKE ? OR description LIKE ? OR member LIKE ?)';
      const search = `%${q}%`;
      params.push(search, search, search, search);
      countParams.push(search, search, search, search);
    }

    const countRow = await db.get(countSql, countParams);
    const total = countRow.total;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const exchanges = await db.all(sql, params);
    // JSON 파싱
    const data = exchanges.map(e => ({
      ...e,
      have_cards: safeParseJSON(e.have_cards),
      want_cards: safeParseJSON(e.want_cards),
    }));

    res.json({
      ok: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// 매칭 조회 - 특정 교환글과 매칭되는 글 찾기
router.get('/:id/matches', async (req, res) => {
  try {
    const db = getDB();
    const exchange = await db.get('SELECT * FROM exchanges WHERE id = ?', [req.params.id]);
    if (!exchange) return res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });

    const myHave = safeParseJSON(exchange.have_cards);
    const myWant = safeParseJSON(exchange.want_cards);

    if (myHave.length === 0 && myWant.length === 0) {
      return res.json({ ok: true, data: [] });
    }

    // 같은 아이돌의 교환중인 다른 글 가져오기
    const candidates = await db.all(
      "SELECT * FROM exchanges WHERE idol = ? AND status = 'exchanging' AND id != ? ORDER BY created_at DESC",
      [exchange.idol, exchange.id]
    );

    const matches = [];
    for (const c of candidates) {
      const theirHave = safeParseJSON(c.have_cards);
      const theirWant = safeParseJSON(c.want_cards);

      // 상대가 가진 카드 중 내가 원하는 카드
      const theyHaveIWant = theirHave.filter(card => myWant.includes(card));
      // 내가 가진 카드 중 상대가 원하는 카드
      const iHaveTheyWant = myHave.filter(card => theirWant.includes(card));

      if (theyHaveIWant.length > 0 && iHaveTheyWant.length > 0) {
        // 쌍방 매칭 (best)
        matches.push({
          ...c,
          have_cards: theirHave,
          want_cards: theirWant,
          match_type: 'mutual',
          they_have_i_want: theyHaveIWant,
          i_have_they_want: iHaveTheyWant,
          match_score: theyHaveIWant.length + iHaveTheyWant.length,
        });
      } else if (theyHaveIWant.length > 0) {
        // 상대가 내가 원하는 카드를 가짐 (partial)
        matches.push({
          ...c,
          have_cards: theirHave,
          want_cards: theirWant,
          match_type: 'partial_they_have',
          they_have_i_want: theyHaveIWant,
          i_have_they_want: [],
          match_score: theyHaveIWant.length,
        });
      } else if (iHaveTheyWant.length > 0) {
        // 내가 상대가 원하는 카드를 가짐 (partial)
        matches.push({
          ...c,
          have_cards: theirHave,
          want_cards: theirWant,
          match_type: 'partial_i_have',
          they_have_i_want: [],
          i_have_they_want: iHaveTheyWant,
          match_score: iHaveTheyWant.length,
        });
      }
    }

    // 쌍방 매칭 우선, 그 다음 점수순
    matches.sort((a, b) => {
      if (a.match_type === 'mutual' && b.match_type !== 'mutual') return -1;
      if (b.match_type === 'mutual' && a.match_type !== 'mutual') return 1;
      return b.match_score - a.match_score;
    });

    res.json({ ok: true, data: matches });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '매칭 조회 실패' });
  }
});

// 교환 등록
router.post('/', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { idol, member, have_cards, want_cards, description, contact, password } = req.body;

    if (!idol || !contact) {
      return res.status(400).json({ ok: false, message: '아이돌과 연락처는 필수입니다' });
    }

    const haveArr = safeParseJSON(have_cards);
    const wantArr = safeParseJSON(want_cards);
    if (haveArr.length === 0 && wantArr.length === 0) {
      return res.status(400).json({ ok: false, message: '보유 카드 또는 희망 카드를 1개 이상 입력하세요' });
    }

    if (!req.user && (!password || password.length < 4)) {
      return res.status(400).json({ ok: false, message: '비밀번호는 4자 이상 입력하세요' });
    }

    const hashedPw = req.user ? '' : bcrypt.hashSync(password, 10);
    let image_url = req.body.image_url || '';
    let thumbnail_url = '';
    if (req.file) {
      const uploaded = await uploadWithThumbnail(req.file.buffer);
      image_url = uploaded.imageUrl;
      thumbnail_url = uploaded.thumbnailUrl;
    }

    await db.run(
      'INSERT INTO exchanges (idol, member, have_cards, want_cards, description, contact, image_url, thumbnail_url, password, user_id, nickname) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [idol, member || '', JSON.stringify(haveArr), JSON.stringify(wantArr), description || '', contact, image_url, thumbnail_url || '', hashedPw, req.user ? req.user.id : null, req.user ? req.user.nickname : null]
    );
    res.json({ ok: true, message: '등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '등록 실패' });
  }
});

// 소유자 확인 헬퍼
async function verifyOwner(req, res) {
  const db = getDB();
  const exchange = await db.get('SELECT * FROM exchanges WHERE id = ?', [req.params.id]);
  if (!exchange) {
    res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });
    return null;
  }
  if (req.user && exchange.user_id && req.user.id === exchange.user_id) {
    return exchange;
  }
  const password = req.body.password || req.headers['x-trade-password'] || '';
  if (!exchange.password || !bcrypt.compareSync(password, exchange.password)) {
    res.status(403).json({ ok: false, message: '비밀번호가 올바르지 않습니다' });
    return null;
  }
  return exchange;
}

// 교환 수정
router.put('/:id', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const exchange = await verifyOwner(req, res);
    if (!exchange) return;

    const db = getDB();
    const { idol, member, have_cards, want_cards, description, contact } = req.body;
    let image_url = req.body.image_url || exchange.image_url;
    let thumbnail_url = exchange.thumbnail_url || '';
    if (req.file) {
      const uploaded = await uploadWithThumbnail(req.file.buffer);
      image_url = uploaded.imageUrl;
      thumbnail_url = uploaded.thumbnailUrl;
    }

    const haveArr = have_cards ? safeParseJSON(have_cards) : safeParseJSON(exchange.have_cards);
    const wantArr = want_cards ? safeParseJSON(want_cards) : safeParseJSON(exchange.want_cards);

    await db.run(
      'UPDATE exchanges SET idol=?, member=?, have_cards=?, want_cards=?, description=?, contact=?, image_url=?, thumbnail_url=? WHERE id=?',
      [idol || exchange.idol, member ?? exchange.member, JSON.stringify(haveArr), JSON.stringify(wantArr), description ?? exchange.description, contact || exchange.contact, image_url, thumbnail_url, req.params.id]
    );
    res.json({ ok: true, message: '수정되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '수정 실패' });
  }
});

// 교환 상태 변경
router.patch('/:id/status', optionalAuth, async (req, res) => {
  try {
    const exchange = await verifyOwner(req, res);
    if (!exchange) return;

    const db = getDB();
    const { status } = req.body;
    if (!['exchanging', 'completed'].includes(status)) {
      return res.status(400).json({ ok: false, message: '유효하지 않은 상태입니다' });
    }
    await db.run('UPDATE exchanges SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, message: '상태가 변경되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '변경 실패' });
  }
});

// 교환 삭제
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const exchange = await verifyOwner(req, res);
    if (!exchange) return;

    const db = getDB();
    await db.run('DELETE FROM exchanges WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '삭제되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '삭제 실패' });
  }
});

// 비밀번호 확인
router.post('/:id/verify', async (req, res) => {
  try {
    const db = getDB();
    const exchange = await db.get('SELECT password FROM exchanges WHERE id = ?', [req.params.id]);
    if (!exchange) return res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });

    const { password } = req.body;
    if (!exchange.password || !bcrypt.compareSync(password || '', exchange.password)) {
      return res.status(403).json({ ok: false, message: '비밀번호가 올바르지 않습니다' });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '확인 실패' });
  }
});

// 게시글 신고
const REPORT_REASONS = ['사기 의심', '허위 매물', '부적절한 내용', '기타'];

router.post('/:id/report', async (req, res) => {
  try {
    const db = getDB();
    const exchange = await db.get('SELECT id FROM exchanges WHERE id = ?', [req.params.id]);
    if (!exchange) return res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });

    const { reason, detail } = req.body;
    if (!reason || !REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ ok: false, message: '신고 사유를 선택하세요' });
    }

    const existing = await db.get(
      'SELECT COUNT(*) as cnt FROM trade_reports WHERE trade_id = ? AND status = ?',
      [req.params.id, 'pending']
    );
    if (existing.cnt >= 5) {
      return res.status(400).json({ ok: false, message: '이미 다수의 신고가 접수된 게시글입니다' });
    }

    await db.run(
      'INSERT INTO trade_reports (trade_id, reason, detail) VALUES (?, ?, ?)',
      [req.params.id, reason, detail || '']
    );
    res.json({ ok: true, message: '신고가 접수되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '신고 접수 실패' });
  }
});

function safeParseJSON(str) {
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str) || []; } catch { return []; }
}

module.exports = router;
