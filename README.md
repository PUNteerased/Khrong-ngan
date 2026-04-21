# LaneYa (เลนยา) — Monorepo

[English](#laneYa-english) · [ภาษาไทย](#laneYa-ภาษาไทย)

---

## LaneYa (ภาษาไทย)

### วิสัยทัศน์

**LaneYa** คือแพลตฟอร์มช่วยประเมินอาการเบื้องต้นและเชื่อมกับระบบตู้จ่ายยาอัจฉริยะ โดยเน้นความปลอดภัยของผู้ใช้ การเก็บข้อมูลสุขภาพสำหรับบริบท AI และเครื่องมือให้ผู้ดูแลระบบจัดการสต็อกยาและบันทึกการให้คำปรึกษา

### เทคโนโลยีหลัก (Stack)

| ชั้น | เทคโนโลยี |
|------|------------|
| **Frontend** | [Next.js](https://nextjs.org/) (App Router), React 19, [next-intl](https://next-intl.dev/), Tailwind CSS v4, shadcn/ui |
| **Backend** | [Express](https://expressjs.com/), TypeScript |
| **ฐานข้อมูล** | [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) |
| **ไฟล์ / รูปภาพ** | [Supabase Storage](https://supabase.com/docs/guides/storage) (เช่น bucket `laneya-images`) |
| **AI** | [Dify](https://dify.ai/) (เรียกจาก backend เท่านั้น — ไม่ส่ง API key ไปเบราว์เซอร์) |

### โครงสร้าง Monorepo

```text
.
├── frontend/          # Next.js (UI, i18n, เรียก API)
├── backend/           # Express API + Prisma
├── docs/              # เอกสารเพิ่มเติม (เช่น AI prompt)
├── render.yaml        # ตัวอย่าง Render Blueprint สำหรับ API
└── package.json       # npm workspaces (ราก)
```

### ข้อมูลใน Prisma ที่เกี่ยวกับยาและผู้ใช้

- **`Drug`**: `imageUrl` — URL รูปยา (เช่นจาก Supabase)
- **`User`**: `avatarUrl`, `age`, `weight` — โปรไฟล์และข้อมูลร่างกาย  
- **`User`**: `allergiesText` + `noAllergies` — ประวัติแพ้ยาแบบข้อความ และธงว่าไม่มีประวัติแพ้

> หมายเหตุ: ใน API/ฝั่ง client มักใช้ชื่อ `allergiesText` สำหรับข้อความแพ้ยา (ไม่ใช่คอลัมน์ชื่อ `allergies` แยกต่างหาก)

### รูปหน้าจอ (เติมไฟล์ภายหลัง)

วางไฟล์รูปใน [`docs/screenshots/`](docs/screenshots/README.md) แล้วแก้ลิงก์ด้านล่างให้ชี้ไปที่ไฟล์จริง

| ตำแหน่ง | ไฟล์ที่แนะนำ | สถานะ |
|---------|----------------|--------|
| แชท AI + คำเตือนทางการแพทย์ | `docs/screenshots/ai-chat.png` | ใส่รูปเมื่อพร้อม |
| แดชบอร์ดผู้ดูแล | `docs/screenshots/admin-dashboard.png` | ใส่รูปเมื่อพร้อม |

```markdown
<!-- ตัวอย่างหลังมีไฟล์จริง -->
![แชท LaneYa AI](docs/screenshots/ai-chat.png)
![แดชบอร์ดผู้ดูแล](docs/screenshots/admin-dashboard.png)
```

### ติดตั้งและรัน (พัฒนา)

**ความต้องการ:** Node.js 18+ (แนะนำ 20+), npm

**1) ติดตั้งแพ็กเกจทั้ง monorepo (ครั้งเดียวที่รากโปรเจกต์)**

```bash
npm install
```

**2) ตั้งค่า Frontend** — ที่โฟลเดอร์ `frontend/`

```bash
copy frontend\.env.local.example frontend\.env.local
```

ตรวจสอบ `NEXT_PUBLIC_API_URL` (ค่าเริ่มต้น `http://localhost:4000`)

**3) ตั้งค่า Backend** — ดู [backend/.env.example](backend/.env.example)

```bash
cd backend
copy .env.example .env
npx prisma migrate deploy
npm run db:seed
cd ..
```

**4) รันสองเทอร์มินัล**

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

จากนั้นเปิด `http://localhost:3000`

บน Windows สามารถดับเบิลคลิก [devrun.bat](devrun.bat) เพื่อเปิด backend + frontend

### Deploy (สรุป)

- **API (Render):** ตั้ง `rootDir` = `backend` (ดู [render.yaml](render.yaml))
- **Frontend (Vercel):** ตั้ง **Root Directory** = `frontend` แล้วตั้ง `NEXT_PUBLIC_API_URL` ชี้ไปที่ URL ของ API

---

## LaneYa (English)

### Vision

**LaneYa** is a platform for preliminary symptom guidance connected to a smart medicine-dispensing workflow. It focuses on user safety, structured health context for the AI assistant, and admin tooling for inventory and consultation records.

### Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | [Next.js](https://nextjs.org/) (App Router), React 19, [next-intl](https://next-intl.dev/), Tailwind CSS v4, shadcn/ui |
| **Backend** | [Express](https://expressjs.com/), TypeScript |
| **Database** | [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) |
| **Media** | [Supabase Storage](https://supabase.com/docs/guides/storage) (e.g. public bucket `laneya-images`) |
| **AI** | [Dify](https://dify.ai/) (server-side only — API keys never exposed to the browser) |

### Monorepo layout

```text
.
├── frontend/          # Next.js app (UI, i18n, calls REST API)
├── backend/           # Express API + Prisma
├── docs/              # Extra docs (e.g. AI system prompt)
├── render.yaml        # Sample Render Blueprint for the API service
└── package.json       # npm workspaces (repository root)
```

### Prisma: drug image & user health fields

- **`Drug`**: `imageUrl` — optional public URL for a drug photo (e.g. Supabase object URL).
- **`User`**: `avatarUrl`, `age`, `weight` — profile photo and basic vitals for chat context.
- **`User`**: `allergiesText` + `noAllergies` — free-text allergy history and a flag when the user states no allergies.

> The API and frontend use the field name `allergiesText` (not a separate Prisma column named `allergies`).

### Screenshots (add files later)

Place images under [`docs/screenshots/`](docs/screenshots/README.md), then uncomment or add image links in this README.

| Area | Suggested file | Status |
|------|----------------|--------|
| AI chat + medical disclaimer | `docs/screenshots/ai-chat.png` | Add when ready |
| Admin dashboard | `docs/screenshots/admin-dashboard.png` | Add when ready |

```markdown
<!-- Example after files exist -->
![LaneYa AI Chat](docs/screenshots/ai-chat.png)
![Admin Dashboard](docs/screenshots/admin-dashboard.png)
```

### Local setup

**Requirements:** Node.js 18+ (20+ recommended), npm

**1) Install all workspaces from the repository root**

```bash
npm install
```

**2) Frontend env** — copy `frontend/.env.local.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL`.

**3) Backend env** — see [backend/.env.example](backend/.env.example), run migrations and seed from `backend/` (same as Thai section).

**4) Run dev servers**

```bash
npm run dev:backend   # API (default :4000)
npm run dev:frontend  # Next.js (default :3000)
```

### Security & `.gitignore`

The root [.gitignore](.gitignore) ignores `.env`, `.env.*`, `node_modules`, `.next/`, `**/dist/`, and build artifacts. **Never commit** production secrets or Supabase service keys.

### Main API routes (reference)

See the Thai section above or the previous detailed API table in git history; high-level routes include `/health`, `/api/auth/*`, `/api/users/me`, `/api/drugs`, `/api/chat`, and `/api/admin/*`.

---

## License

Private project — see your team’s policy.
