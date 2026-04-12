# Huong dan setup nhanh (Tieng Viet)

Tai lieu nay dung cho truong hop clone du an ve may moi va chay local nhanh.

## 1) Dieu kien can co

- Da cai Git
- Da cai Docker Desktop
- Da cai Node.js 20+ va npm

## 2) Clone du an

```bash
git clone <URL_REPO>
cd zalo-lite
```

## 3) Chay database bang Docker

```bash
docker compose -f infrastructure/docker/docker-compose.databases.yml up -d
```

Kiem tra container:

```bash
docker ps
```

Ban se thay cac service: `zalo-postgres`, `zalo-redis`, `zalo-dynamodb-local`.

## 4) Chay backend

### 4.1 User service

```bash
cd backend/services/user-service
npm install
npm run dev
```

### 4.2 Chat service

Mo terminal moi:

```bash
cd backend/services/chat-service
npm install
npm run dev
```

## 5) Chay frontend web

Mo terminal moi:

```bash
cd frontend/web
npm install
npm run dev
```

Mo trinh duyet: `http://localhost:3000`

## 6) Tai khoan test nhanh

- Admin: `admin@example.com` / `test12345`
- User A: `usera@example.com` / `test12345`
- User B: `userb@example.com` / `test12345`
- User C: `userc@example.com` / `test12345`

## 7) Lenh hay dung

Xem log database:

```bash
docker compose -f infrastructure/docker/docker-compose.databases.yml logs -f
```

Dung database:

```bash
docker compose -f infrastructure/docker/docker-compose.databases.yml stop
```

Tat va xoa container database:

```bash
docker compose -f infrastructure/docker/docker-compose.databases.yml down
```

Reset toan bo du lieu database (xoa volume):

```bash
docker compose -f infrastructure/docker/docker-compose.databases.yml down -v
```

---

Neu may dung `docker-compose` (ban cu), thay `docker compose` bang `docker-compose`.
