# LaneYa (เลนยา)

แอปพลิเคชัน Next.js + API Express สำหรับระบบตู้จ่ายยาอัจฉริยะ

## ความต้องการของระบบ

- Node.js 18+
- npm

## ติดตั้งครั้งแรก

### Frontend (โฟลเดอร์โปรเจกต์)

```bash
npm install
```

คัดลอก `.env.local.example` เป็น `.env.local` และตรวจสอบว่า `NEXT_PUBLIC_API_URL` ชี้ไปที่ API (ค่าเริ่มต้น `http://localhost:4000`)

### Backend

```bash
cd backend
npm install
copy .env.example .env
```

แก้ไข `backend/.env`:

- `DATABASE_URL` — **PostgreSQL** (ดูตัวอย่างใน `backend/.env.example`) โปรเจกต์ใช้ Prisma กับ Postgres แล้ว ไม่ใช้ SQLite
- `JWT_SECRET` — สตริงยาวพอสำหรับ production
- `DIFY_API_KEY` — จาก Dify (Chat Application)
- `CORS_ORIGIN` — ต้องตรงกับ URL ของ Next.js (เช่น `http://localhost:3000` หรือ `https://ชื่อโปรเจกต์.vercel.app`)
- **ผู้ดูแล**: หลัง `npm run db:seed` จะสร้างบัญชีผู้ดูแลจาก `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD` ใน `.env` (ค่าเริ่มต้นใน `.env.example` คือ `admin` / `laneYa_admin_dev`) — เข้าหน้า `/admin` ด้วยชื่อผู้ใช้ + รหัสผ่านนี้ได้ทันที **อย่าใช้รหัสเริ่มต้นใน production**; หรือตั้ง `User.isAdmin = true` ให้บัญชีที่ลงทะเบียนเองใน Prisma Studio; ทางเลือก `ADMIN_JWT_SECRET` ถ้าต้องการแยกจาก `JWT_SECRET`

หลังแก้ไข `backend/.env` ให้ **หยุดแล้วรัน `npm run dev` ของ backend ใหม่** จึงจะอ่านค่า `DIFY_API_KEY` ล่าสุด ตอนสตาร์ท API จะมี log ว่าโหลด `.env` จาก path ใด และถ้ายังไม่มีคีย์ Dify จะมีข้อความเตือนในเทอร์มินัล

สร้าง schema บน PostgreSQL และ seed ยา (ครั้งแรกหลังมี `DATABASE_URL`):

```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

สำหรับพัฒนา: รัน Postgres ในเครื่องได้ด้วย Docker เช่น  
`docker run -d --name laneya-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=laneya -p 5432:5432 postgres:16`  
แล้วตั้ง `DATABASE_URL` ให้ตรงกับค่าใน `.env.example`

คำสั่งอื่น: `npm run db:deploy` (= `prisma migrate deploy`), `npm run db:seed`

## รันแบบพัฒนา (สองเทอร์มินัล)

**Terminal 1 — API**

```bash
cd backend
npm run dev
```

**Terminal 2 — Next.js**

```bash
npm run dev
```

จากนั้นเปิดเบราว์เซอร์ที่ `http://localhost:3000`

## รันครั้งเดียวบน Windows

ดับเบิลคลิก `dev-all.bat` ที่รากโปรเจกต์ — จะเปิดสองหน้าต่าง Command Prompt สำหรับ backend และ frontend

## Dify

Backend เรียก `POST /v1/chat-messages` โดยใช้ `DIFY_API_KEY` เท่านั้น (ไม่ส่งไปฝั่งเบราว์เซอร์)

Backend ส่งค่าเดียวกันไปพร้อมหลายชื่อ เพื่อให้เข้ากับเทมเพลต Dify ต่างๆ:

- `allergies` / `allergy_context` — ประวัติแพ้ยา (ข้อความ)
- `diseases` / `disease_context` — โรคประจำตัว (ข้อความ)
- `age` — อายุ (ข้อความ เช่น `25 ปี`)
- `weight` — น้ำหนัก (ข้อความ เช่น `70 กก.`)

ใน Dify ให้ตั้งชื่อตัวแปรในแอปให้ตรงอย่างน้อยหนึ่งชุดข้างบน (หรือแก้ prompt ให้ใช้ชื่อที่ backend ส่ง)

หากไม่ตั้ง `DIFY_API_KEY` การแชทจะได้ข้อความ error จาก API (502)

## ความปลอดภัยเบื้องต้น

- API ใช้ **helmet** สำหรับ HTTP security headers
- **rate limit** บน `POST /api/auth/register`, `/api/auth/login`, `/api/admin/login`, `POST /api/chat`
- **ประวัติแชท** (`GET /api/chat/sessions` และ `/messages`) คืนเฉพาะของผู้ใช้ที่ล็อกอิน (JWT)
- **แดชบอร์ดผู้ดูแล** (`GET /api/admin/*`) ต้องมี JWT จาก `POST /api/admin/login` (ชื่อผู้ใช้ + รหัสผ่านของบัญชี `isAdmin`; เก็บใน `sessionStorage` ฝั่งเบราว์เซอร์)
- **แก้ไขยา** (POST/PATCH/DELETE, เติมสต็อก): ต้องใช้ JWT ผู้ดูแล **หรือ** header `x-admin-key` ถ้าตั้ง `ADMIN_API_KEY` (สำหรับสคริปต์/เครื่องมือ)
- Production: ใช้ HTTPS, ไม่ commit `.env`; จำกัดจำนวนบัญชี `isAdmin` ให้น้อยที่สุด

## โครงสร้าง API หลัก

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/health` | สถานะเซิร์ฟเวอร์ |
| POST | `/api/auth/register` | ลงทะเบียน |
| POST | `/api/auth/login` | เข้าสู่ระบบ (JWT) |
| GET/PATCH | `/api/users/me` | โปรไฟล์ (Bearer user) |
| GET | `/api/drugs` | รายการยาในตู้ |
| POST/PATCH/DELETE … | `/api/drugs` | จัดการยา (JWT ผู้ดูแล หรือ `x-admin-key`) |
| POST | `/api/chat` | แชทผ่าน Dify (Bearer user) |
| GET | `/api/chat/sessions` | รายการแชทของฉัน |
| GET | `/api/chat/sessions/:id/messages` | ข้อความใน session (เฉพาะเจ้าของ) |
| POST | `/api/admin/login` | เข้าสู่ระบบผู้ดูแล (ชื่อผู้ใช้ + รหัสผ่าน, `isAdmin`) → JWT admin |
| GET | `/api/admin/stats` | สถิติ (Bearer admin) |

## Deploy: Vercel + Render + PostgreSQL

โครงสร้าง: **Next.js บน Vercel** (ราก repo) + **Express บน Render** (`backend/`) + **PostgreSQL** (Render Postgres หรือ Neon ฯลฯ)

ไฟล์ [render.yaml](render.yaml) ใช้เป็น Render Blueprint สำหรับ Web Service (แก้ `region` / `name` ได้ตามต้องการ)

### 1. PostgreSQL

- สร้างฐานข้อมูลบน Render (หรือผู้ให้บริการอื่น) แล้วคัดลอก **connection string** มาเป็น `DATABASE_URL`

### 2. Render — API

- เชื่อม GitHub repo เดียวกับโปรเจกต์นี้
- ถ้าใช้ Blueprint: นำเข้า `render.yaml` หรือสร้าง **Web Service** ด้วยมือ โดย **Root Directory** = `backend`
- **Build Command**: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy` (เหมือนใน `render.yaml`)
- **Start Command**: `npm start`
- **Environment** (ตั้งใน Dashboard ก่อน build ครั้งแรก เพราะ migrate ต้องใช้ DB):
  - `DATABASE_URL` — จากขั้นตอนที่ 1
  - `JWT_SECRET`, `DIFY_API_KEY`, `DIFY_API_BASE`, `DIFY_APP_ID` ตามต้องการ
  - `CORS_ORIGIN` = URL ของเว็บบน Vercel (เช่น `https://xxx.vercel.app`) รวม `https://`; ถ้ายังไม่มี URL ชั่วคราวใช้ `http://localhost:3000` แล้วค่อยแก้หลัง deploy Vercel แล้ว **Redeploy** service
  - `ADMIN_SEED_*`, `ADMIN_JWT_SECRET`, `ADMIN_API_KEY` ตาม [backend/.env.example](backend/.env.example)
- หลัง deploy สำเร็จ: เปิด **Shell** บน Render แล้วรัน `npm run db:seed` ครั้งหนึ่ง (ยา + บัญชี admin seed) — หรือรันจากเครื่อง local ที่ชี้ `DATABASE_URL` ไป production (ระวังความปลอดภัย)

### 3. Vercel — Frontend

- Import GitHub repo เดียวกัน, **Root** = รากโปรเจกต์ (Next.js)
- ตั้ง **Environment Variable**: `NEXT_PUBLIC_API_URL` = URL สาธารณะของ API บน Render (เช่น `https://laneya-api.onrender.com`) **ไม่ใส่ slash ท้าย**
- Deploy แล้วอัปเดต `CORS_ORIGIN` บน Render ให้ตรงกับ URL Vercel จริง แล้ว trigger redeploy API ถ้าจำเป็น

### 4. หมายเหตุ

- แพลนฟรีของ Render อาจ **sleep** เมื่อไม่มี traffic (cold start ช้าได้)
- ถ้า build บน Render ล้มเรื่อง Prisma engine ดู [binary targets](https://www.prisma.io/docs/orm/prisma-schema/generators#binary-targets) ใน `schema.prisma` (มี `debian-openssl-3.0.x` สำหรับ Linux แล้ว)
- อย่า commit `.env` / connection string ลง Git
