const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDB } = require('../db');
const logger = require('../logger');
const sharp = require('sharp');
const { imageFileFilter, randomFilename } = require('../middleware');

const uploadDir = path.join(__dirname, '..', 'uploads');
const thumbDir = path.join(uploadDir, 'thumbs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, randomFilename(file.originalname)),
});

// 썸네일 생성 (400px 리사이즈, webp)
async function createThumbnail(filename) {
  try {
    const input = path.join(uploadDir, filename);
    const thumbName = path.parse(filename).name + '_thumb.webp';
    const output = path.join(thumbDir, thumbName);
    await sharp(input).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(output);
    return `/uploads/thumbs/${thumbName}`;
  } catch {
    return null;
  }
}
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// 중고거래 목록 (필터 + 검색 + 페이지네이션)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { idol, status, q, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT id, title, description, idol, price, contact, image_url, thumbnail_url, status, created_at FROM trades WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM trades WHERE 1=1';
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
    if (q) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      countSql += ' AND (title LIKE ? OR description LIKE ?)';
      const search = `%${q}%`;
      params.push(search, search);
      countParams.push(search, search);
    }

    const countRow = await db.get(countSql, countParams);
    const total = countRow.total;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const trades = await db.all(sql, params);
    res.json({
      ok: true,
      data: trades,
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

// 중고거래 등록 (비밀번호 필수)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { title, description, idol, price, contact, password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ ok: false, message: '비밀번호는 4자 이상 입력하세요' });
    }

    const hashedPw = bcrypt.hashSync(password, 10);
    const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '');
    const thumbnail_url = req.file ? await createThumbnail(req.file.filename) : '';

    await db.run(
      'INSERT INTO trades (title, description, idol, price, contact, image_url, thumbnail_url, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', idol, parseInt(price) || 0, contact, image_url, thumbnail_url || '', hashedPw]
    );
    res.json({ ok: true, message: '등록되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '등록 실패' });
  }
});

// 비밀번호 확인 헬퍼
async function verifyTradePassword(req, res) {
  const db = getDB();
  const trade = await db.get('SELECT * FROM trades WHERE id = ?', [req.params.id]);
  if (!trade) {
    res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });
    return null;
  }
  const password = req.body.password || req.headers['x-trade-password'] || '';
  if (!trade.password || !bcrypt.compareSync(password, trade.password)) {
    res.status(403).json({ ok: false, message: '비밀번호가 올바르지 않습니다' });
    return null;
  }
  return trade;
}

// 중고거래 수정
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const trade = await verifyTradePassword(req, res);
    if (!trade) return;

    const db = getDB();
    const { title, description, idol, price, contact } = req.body;
    const image_url = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.image_url || trade.image_url);
    const thumbnail_url = req.file
      ? (await createThumbnail(req.file.filename) || '')
      : (trade.thumbnail_url || '');

    await db.run(
      'UPDATE trades SET title=?, description=?, idol=?, price=?, contact=?, image_url=?, thumbnail_url=? WHERE id=?',
      [title || trade.title, description ?? trade.description, idol || trade.idol,
       parseInt(price) || trade.price, contact || trade.contact, image_url, thumbnail_url, req.params.id]
    );
    res.json({ ok: true, message: '수정되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '수정 실패' });
  }
});

// 중고거래 상태 변경 (비밀번호 필요)
router.patch('/:id/status', async (req, res) => {
  try {
    const trade = await verifyTradePassword(req, res);
    if (!trade) return;

    const db = getDB();
    const { status } = req.body;
    await db.run('UPDATE trades SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, message: '상태가 변경되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '변경 실패' });
  }
});

// 중고거래 삭제 (비밀번호 필요)
router.delete('/:id', async (req, res) => {
  try {
    const trade = await verifyTradePassword(req, res);
    if (!trade) return;

    const db = getDB();
    await db.run('DELETE FROM trades WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '삭제되었습니다' });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '삭제 실패' });
  }
});

// 비밀번호 확인 (프론트에서 수정/삭제 전 확인용)
router.post('/:id/verify', async (req, res) => {
  try {
    const db = getDB();
    const trade = await db.get('SELECT password FROM trades WHERE id = ?', [req.params.id]);
    if (!trade) return res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });

    const { password } = req.body;
    if (!trade.password || !bcrypt.compareSync(password || '', trade.password)) {
      return res.status(403).json({ ok: false, message: '비밀번호가 올바르지 않습니다' });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '확인 실패' });
  }
});

// 거래글 신고
const REPORT_REASONS = ['사기 의심', '허위 매물', '부적절한 내용', '기타'];

router.post('/:id/report', async (req, res) => {
  try {
    const db = getDB();
    const trade = await db.get('SELECT id FROM trades WHERE id = ?', [req.params.id]);
    if (!trade) return res.status(404).json({ ok: false, message: '게시글을 찾을 수 없습니다' });

    const { reason, detail } = req.body;
    if (!reason || !REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ ok: false, message: '신고 사유를 선택하세요' });
    }

    // 같은 글에 대한 중복 pending 신고 제한 (5건)
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

module.exports = router;
