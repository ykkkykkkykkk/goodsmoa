const path = require('path');

let db;

async function initDB() {
  const isTurso = !!process.env.TURSO_DATABASE_URL;

  if (isTurso) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL.replace(/\s+/g, ''),
      authToken: process.env.TURSO_AUTH_TOKEN.replace(/\s+/g, ''),
    });
    db = {
      async run(sql, params = []) {
        return client.execute({ sql, args: params });
      },
      async get(sql, params = []) {
        const result = await client.execute({ sql, args: params });
        return result.rows[0] || null;
      },
      async all(sql, params = []) {
        const result = await client.execute({ sql, args: params });
        return result.rows;
      },
      async exec(sql) {
        const statements = sql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          await client.execute(stmt);
        }
      },
    };
  } else {
    const Database = require('better-sqlite3');
    const raw = new Database(path.join(__dirname, 'data.db'));
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');
    db = {
      async run(sql, params = []) {
        return raw.prepare(sql).run(...params);
      },
      async get(sql, params = []) {
        return raw.prepare(sql).get(...params);
      },
      async all(sql, params = []) {
        return raw.prepare(sql).all(...params);
      },
      async exec(sql) {
        return raw.exec(sql);
      },
    };
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS idols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#000000',
      debut TEXT,
      agency TEXT
    );

    CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idol TEXT NOT NULL,
      member TEXT NOT NULL DEFAULT '',
      have_cards TEXT NOT NULL DEFAULT '[]',
      want_cards TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      contact TEXT NOT NULL,
      image_url TEXT,
      thumbnail_url TEXT DEFAULT '',
      status TEXT DEFAULT 'exchanging',
      password TEXT NOT NULL DEFAULT '',
      user_id INTEGER DEFAULT NULL,
      nickname TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      url TEXT NOT NULL,
      image_url TEXT,
      idol TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '전체',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      url TEXT NOT NULL,
      image_url TEXT,
      idol TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '온라인몰',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trade_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nickname TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL DEFAULT 'main',
      ip TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poca_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poca_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      thumbnail_url TEXT DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '',
      rarity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poca_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'comment',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poca_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 인덱스 생성
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exchanges_idol ON exchanges(idol);
    CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
    CREATE INDEX IF NOT EXISTS idx_exchanges_created ON exchanges(created_at);
    CREATE INDEX IF NOT EXISTS idx_banners_idol ON banners(idol);
    CREATE INDEX IF NOT EXISTS idx_banners_category ON banners(category);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_trade_reports_status ON trade_reports(status);
    CREATE INDEX IF NOT EXISTS idx_trade_reports_trade ON trade_reports(trade_id);
    CREATE INDEX IF NOT EXISTS idx_exchanges_member ON exchanges(member);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
    CREATE INDEX IF NOT EXISTS idx_poca_posts_user ON poca_posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_poca_cards_post ON poca_cards(post_id);
    CREATE INDEX IF NOT EXISTS idx_poca_cards_artist ON poca_cards(artist);
    CREATE INDEX IF NOT EXISTS idx_poca_comments_card ON poca_comments(card_id);
    CREATE INDEX IF NOT EXISTS idx_poca_reactions_card ON poca_reactions(card_id);
    CREATE INDEX IF NOT EXISTS idx_poca_reactions_user_card ON poca_reactions(user_id, card_id);
  `);

  // 기본 아이돌 데이터 삽입
  const count = await db.get('SELECT COUNT(*) as cnt FROM idols');
  if (count.cnt === 0) {
    const defaultIdols = [
      ['방탄소년단', '#7B2D8B', '2013-06-13', 'BIGHIT MUSIC'],
      ['세븐틴', '#F5C5C5', '2015-05-26', 'PLEDIS Entertainment'],
      ['스트레이키즈', '#FF3333', '2018-03-25', 'JYP Entertainment'],
      ['에스파', '#6C47FF', '2020-11-17', 'SM Entertainment'],
      ['뉴진스', '#0085FF', '2022-08-01', 'ADOR'],
      ['아이브', '#FFB6C1', '2021-12-01', 'STARSHIP Entertainment'],
      ['에이티즈', '#E00000', '2018-10-24', 'KQ Entertainment'],
      ['투모로우바이투게더', '#C1E8FF', '2019-03-04', 'BIGHIT MUSIC'],
      ['르세라핌', '#000000', '2022-05-02', 'SOURCE MUSIC'],
      ['엔시티', '#00C73C', '2016-04-09', 'SM Entertainment'],
    ];
    for (const [name, color, debut, agency] of defaultIdols) {
      await db.run(
        'INSERT OR IGNORE INTO idols (name, color, debut, agency) VALUES (?, ?, ?, ?)',
        [name, color, debut, agency]
      );
    }
  }

  return db;
}

module.exports = { initDB, getDB: () => db };
