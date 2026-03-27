#!/usr/bin/env node

/**
 * SQLite DB 백업 스크립트
 *
 * 사용법:
 *   node scripts/backup.js
 *
 * cron 예시 (매일 새벽 3시):
 *   0 3 * * * cd /app/server && node scripts/backup.js >> logs/backup.log 2>&1
 *
 * Docker:
 *   docker exec goodsmoa node server/scripts/backup.js
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 14; // 최근 14일치 보관

function backup() {
  // 백업 디렉토리 생성
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // DB 파일 존재 확인
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[BACKUP] DB 파일을 찾을 수 없습니다: ${DB_PATH}`);
    process.exit(1);
  }

  // 백업 파일명 (날짜+시간)
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `data_${timestamp}.db`);

  // 파일 복사
  try {
    fs.copyFileSync(DB_PATH, backupFile);
    const size = (fs.statSync(backupFile).size / 1024).toFixed(1);
    console.log(`[BACKUP] ${now.toISOString()} - ${backupFile} (${size}KB)`);
  } catch (err) {
    console.error(`[BACKUP] 백업 실패:`, err.message);
    process.exit(1);
  }

  // 오래된 백업 삭제
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      const fullPath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(fullPath);
      console.log(`[BACKUP] 오래된 백업 삭제: ${file}`);
    }
  }

  console.log(`[BACKUP] 완료. 현재 백업 수: ${Math.min(backups.length, MAX_BACKUPS)}`);
}

backup();
