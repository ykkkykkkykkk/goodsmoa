# 굿즈모아 Render 배포 가이드

## 1단계: Turso DB 생성 (무료)

```bash
# Turso CLI 설치
curl -sSfL https://get.tur.so/install.sh | bash

# 로그인
turso auth login

# DB 생성
turso db create goodsmoa

# URL 확인
turso db show goodsmoa --url
# → libsql://goodsmoa-xxxxxx.turso.io

# 토큰 생성
turso db tokens create goodsmoa
# → eyJhbGciOi...
```

## 2단계: GitHub 저장소 Push

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/goodsmoa.git
git push -u origin main
```

## 3단계: Render 배포

1. https://render.com 접속 → GitHub 로그인
2. **New > Web Service** → GitHub 저장소 연결
3. 설정:
   - **Build Command**: `npm ci && npm run build && cd server && npm ci --omit=dev`
   - **Start Command**: `cd server && node index.js`
4. **Environment Variables** 추가:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | (강력한 비밀번호) |
| `JWT_SECRET` | (32자 이상 랜덤 문자열) |
| `ALLOWED_ORIGIN` | `https://goodsmoa.onrender.com` (배포 후 실제 URL) |
| `TURSO_DATABASE_URL` | `libsql://goodsmoa-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | (1단계에서 생성한 토큰) |

5. **Create Web Service** 클릭

## 4단계: 배포 확인

배포 완료 후 `https://goodsmoa.onrender.com/api/health` 접속하여 확인.

## 참고

- Render 무료 티어: 15분 미사용 시 sleep, 요청 시 자동 wake (최초 응답 느림)
- 이미지 업로드: Render 무료 티어에서는 배포 시 초기화됨. 이미지 URL 직접 입력 권장
- Turso 무료 티어: 9GB 스토리지, 500M rows read/month
