const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDB } = require('../db');
const { signUserToken, loginLimiter, authUser } = require('../middleware');
const logger = require('../logger');

// 회원가입
router.post('/signup', loginLimiter, async (req, res) => {
  try {
    const db = getDB();
    const { username, password, nickname } = req.body;

    if (!username || !password || !nickname) {
      return res.status(400).json({ ok: false, message: '아이디, 비밀번호, 닉네임을 모두 입력하세요' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ ok: false, message: '아이디는 3~20자로 입력하세요' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ ok: false, message: '아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다' });
    }
    if (password.length < 4) {
      return res.status(400).json({ ok: false, message: '비밀번호는 4자 이상 입력하세요' });
    }
    if (nickname.length < 2 || nickname.length > 10) {
      return res.status(400).json({ ok: false, message: '닉네임은 2~10자로 입력하세요' });
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ ok: false, message: '이미 사용 중인 아이디입니다' });
    }

    const existingNick = await db.get('SELECT id FROM users WHERE nickname = ?', [nickname]);
    if (existingNick) {
      return res.status(400).json({ ok: false, message: '이미 사용 중인 닉네임입니다' });
    }

    const hashedPw = bcrypt.hashSync(password, 10);
    await db.run(
      'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
      [username, hashedPw, nickname]
    );

    const user = await db.get('SELECT id, nickname FROM users WHERE username = ?', [username]);
    const token = signUserToken(user);

    res.json({ ok: true, token, user: { id: user.id, nickname: user.nickname } });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '회원가입 실패' });
  }
});

// 로그인
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const db = getDB();
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: '아이디와 비밀번호를 입력하세요' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다' });
    }

    const token = signUserToken(user);
    res.json({ ok: true, token, user: { id: user.id, nickname: user.nickname } });
  } catch (err) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ ok: false, message: '로그인 실패' });
  }
});

// 내 정보 확인
router.get('/me', authUser, async (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
