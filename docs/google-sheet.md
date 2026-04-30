# Google Sheet Table Design (Knowledge + Health Tips + i18n)

เอกสารนี้เป็นสเปกสำหรับออกแบบตารางใน Google Sheet เพื่อให้ระบบ LaneYa สามารถ:

- ซิงค์คลังข้อมูล (โรค / อาการ / ยา + **แท็บ mapping แยก 3 แท็บเท่านั้น** — **ไม่มี**แท็บ `mappings` แบบรวม)
- ซิงค์เกล็ดความรู้สุขภาพ + อ้างอิง + ข้อความ UI
- รองรับข้อมูลสองภาษา (TH/EN) พร้อม fallback

## สรุปสั้นตามที่ใช้งานจริง

### ภาษา (ชีท → DB → API → หน้าเว็บ)

- คอลัมน์หลักเป็นแพตเทิร์น `*_th` / `_*_en` (และ legacy ที่ระบบยังอ่านได้ — ดูแต่ละแท็บด้านล่าง)
- **ตอนซิงค์**
  - **HealthTip**: ถ้า `summary_en` / `content_md_en` ว่าง ระบบเก็บค่า EN เป็นข้อความไทย (copy จาก TH) เพื่อให้ API `lang=en` มีข้อความแสดง
  - **I18N_UI**: ต้องมีอย่างน้อย `th` **หรือ** `en` หนึ่งฝั่ง; ถ้า EN ว่างจะเติมจาก TH; ถ้า TH ว่างจะใช้ EN เป็นฐาน TH
- **ตอนเรียก API** (query `lang=th` หรือ `lang=en`, default `th`)
  - `lang=en`: ส่งฟิลด์ที่ project แล้วเป็นภาษาอังกฤษ ถ้า EN ว่างใน DB จะ **fallback เป็นค่าไทย**
  - `lang=th`: ใช้ค่าไทยเป็นหลัก

Endpoints ที่รองรับ `lang`:

- `GET /api/knowledge/search?q=...&lang=...`
- `GET /api/knowledge/diseases?lang=...`
- `GET /api/knowledge/symptoms?lang=...`
- `GET /api/knowledge/drugs?lang=...`
- `GET /api/knowledge/diseases/:slug?lang=...`
- `GET /api/knowledge/symptoms/:slug?lang=...`
- `GET /api/knowledge/drugs/:idOrSlug?lang=...`
- `GET /api/health-tips/search?lang=...`
- `GET /api/health-tips/:slug?lang=...`
- `GET /api/i18n/ui?namespace=...&lang=...`

หน้าเว็บส่ง `lang` ให้สอดคล้องกับ locale ของผู้ใช้ และโหลดป้ายกำกับจาก `/api/i18n/ui` (เช่น namespace `Home` สำหรับปุ่มทางลัดหน้าแรก)

---

## 1) โครงแท็บที่ต้องมี

| แท็บ | หมายเหตุ |
|------|-----------|
| `Disease` | โรค |
| `Symptom` | อาการ |
| `Drug` | ยาในตู้ (อ้าง `drug_ref`) |
| `Map_Disease_Symptom` | ความสัมพันธ์ โรค–อาการ |
| `Map_Disease_Drug` | ความสัมพันธ์ โรค–ยา |
| `Map_Symptom_Drug` | ความสัมพันธ์ อาการ–ยา |
| `HealthTip` | บทความ / tips |
| `HealthTip_Ref` | อ้างอิงภายนอกต่อ tip |
| `I18N_UI` | ข้อความ UI แบบ key-value |

**ไม่ใช้**แท็บรวมชื่อเช่น `mappings` — mapping ต้องอยู่ใน 3 แท็บด้านบนเท่านั้น

---

## 2) Header ที่รองรับในแต่ละแท็บ

Headers ใน Google Sheet จะถูก normalize เป็น **ตัวพิมพ์เล็ก** ตอนซิงค์ (`Name_TH` → `name_th`)

### 2.1 `Disease` (แนะนำ = สคีมาสองภาษา)

```csv
slug,name_th,name_en,definition_th,definition_en,severity_level,self_care_th,self_care_en,red_flag_th,red_flag_en,keywords,published
```

**Legacy (ยังอ่านได้):** `definition`, `self_care_advice`, `red_flag_advice` แทน `*_th`

### 2.2 `Symptom`

```csv
slug,name_th,name_en,observation_th,observation_en,first_aid,danger_level,red_flag,keywords,published
```

**Legacy:** `observation_guide` แทน `observation_th`

### 2.3 `Drug`

```csv
drug_ref,slug,generic_name,brand_name_th,brand_name_en,indication_th,indication_en,contraindications,dose_th,dose_en,knowledge_priority,keywords,published
```

**Legacy:** `brand_name`, `indication`, `dose_by_age_weight` แทนฝั่งไทย

- `drug_ref`: **บังคับ** — อ้าง `Drug.id` หรือ `slotId` ของยาในฐานข้อมูล (หรือ slug ถ้ามีคอลัมน์ `slug`)
- ถ้า `drug_ref` ยังไม่มีใน DB และไม่ได้เปิด `KNOWLEDGE_SYNC_CREATE_MISSING_DRUGS=1` แถวนั้นจะ error ตอน dry-run

### 2.4 `Map_Disease_Symptom`

```csv
disease_slug,symptom_slug,relevance_score,note
```

**Legacy:** `score` แทน `relevance_score`; `left_slug`/`right_slug` แทน disease/symptom (ไม่แนะนำ)

### 2.5 `Map_Disease_Drug`

```csv
disease_slug,drug_ref,recommendation_level,note
```

### 2.6 `Map_Symptom_Drug`

```csv
symptom_slug,drug_ref,recommendation_level,note
```

### 2.7 `HealthTip`

```csv
slug,title_th,title_en,summary_th,summary_en,content_md_th,content_md_en,keywords,category,cover_image_url,published
```

**Legacy:** `title`, `content_md` (ไทย)

คอลัมน์ขั้นต่ำสำหรับ sync: `slug` + `title_th` (หรือ `title`)

### 2.8 `HealthTip_Ref`

```csv
tip_slug,ref_title,ref_url,ref_publisher,accessed_at,note,published
```

**Legacy:** `ref_title`/`ref_url` จาก `title`/`url` ได้บางกรณี

- `tip_slug` ต้องชี้ไปที่ slug ในแท็บ `HealthTip` (รวมแถวที่กำลัง sync ในรอบเดียวกัน)

### 2.9 `I18N_UI`

```csv
namespace,key,th,en,published,updated_by,updated_at
```

- ต้องมี `namespace`, `key` และอย่างน้อย `th` **หรือ** `en` หนึ่งค่า
- ตัวอย่าง key หน้าแรก: `quickDrug`, `quickDisease`, `quickSymptom`, `quickHistory` (namespace `Home`)

---

## 3) Dry-run และการตรวจอ้างอิงข้ามแท็บ

รันผ่าน Admin หรือ CLI (`npm run knowledge:sync -- --dry-run`):

1. **Disease / Symptom**: แถวที่ไม่มี `slug` + `name_th` (หรือ `name`) → error แท็บ + เลขแถว
2. **Drug**: ไม่มี `drug_ref` → error; `drug_ref` ไม่พบใน DB (เมื่อไม่สร้างยาใหม่) → error; `knowledge_priority` ไม่ใช่ตัวเลข → error
3. **Map_Disease_Symptom**: `disease_slug` / `symptom_slug` ต้องอยู่ในแท็บ Disease/Symptom (รวมแถวในรอบเดียวกัน **หรือ** ที่มีอยู่แล้วใน DB); `relevance_score` ต้องเป็นตัวเลขถ้ามีค่า
4. **Map_Disease_Drug / Map_Symptom_Drug**: `drug_ref` ต้องปรากฏในแท็บ **Drug** ของชีทรอบนี้ (normalize ตัวพิมพ์เล็กเทียบกับ `drug_ref` ในชีท)
5. **HealthTip_Ref**: `tip_slug` ต้องมีในแท็บ HealthTip
6. **I18N_UI**: ขาด `namespace`/`key` หรือไม่มีทั้ง `th` และ `en` → error

ถ้ามี error อย่างน้อย 1 แถว **sync จริงจะไม่รัน** (transaction ไม่ commit)

ผลลัพธ์ dry-run/sync มีฟิลด์สรุปต่อแท็บ: `inserted`, `updated`, `deleted`, `skipped` และ `errors[]` (แต่ละ error มี `tab`, `rowNumber`, `message`, `row`)

---

## 4) Data Validation ที่แนะนำใน Google Sheets

- `published`: dropdown = `TRUE,FALSE`
- `slug`, `tip_slug`, `disease_slug`, `symptom_slug`: รูปแบบ `kebab-case` ไม่เว้นวรรค
- `HealthTip_Ref.tip_slug`: dropdown จาก `HealthTip!A2:A` (slug)
- `Map_*`: dropdown อ้างอิงคอลัมน์ slug ของ Disease / Symptom และ `drug_ref` จากแท็บ Drug
- `ref_url`: ขึ้นต้นด้วย `http://` หรือ `https://`
- `knowledge_priority`, `relevance_score`: ตัวเลข

---

## 5) Mapping กับ backend env

```env
KNOWLEDGE_SHEET_TAB_DISEASE=Disease
KNOWLEDGE_SHEET_TAB_SYMPTOM=Symptom
KNOWLEDGE_SHEET_TAB_DRUG=Drug
KNOWLEDGE_SHEET_TAB_MAP_DISEASE_SYMPTOM=Map_Disease_Symptom
KNOWLEDGE_SHEET_TAB_MAP_DISEASE_DRUG=Map_Disease_Drug
KNOWLEDGE_SHEET_TAB_MAP_SYMPTOM_DRUG=Map_Symptom_Drug
KNOWLEDGE_SHEET_TAB_HEALTH_TIP=HealthTip
KNOWLEDGE_SHEET_TAB_HEALTH_TIP_REF=HealthTip_Ref
KNOWLEDGE_SHEET_TAB_I18N_UI=I18N_UI
```

ดูตัวอย่างค่าเต็มใน `backend/.env.example`

---

## 6) ขั้นตอนใช้งานจริง (Sync workflow)

1. เตรียม/แก้ข้อมูลในชีทตาม header ที่กำหนด
2. ตรวจว่าตั้งชื่อแท็บตรงกับ env
3. รัน dry-run:

```bash
cd backend
npm run knowledge:sync -- --dry-run
```

4. ถ้า `errors: []` ให้ sync จริง:

```bash
npm run knowledge:sync
```

หรือใช้หน้า **Admin** → Dry-run / Sync (แสดงสรุปรวม Health tip / I18N UI)

5. ตรวจผลบนหน้าเว็บ:

- `/knowledge` และหน้ารายละเอียดโรค/อาการ/ยา
- `/health-tips` และ `/health-tips/[slug]` (markdown)
- `GET /api/i18n/ui?namespace=Home&lang=th|en`

---

## 7) ตรวจเทียบกับโค้ด (Verification)

| หัวข้อ | ตำแหน่ง |
|--------|---------|
| Sync + validation | `backend/src/services/knowledgeSheetSync.service.ts` |
| โปรเจกชันตาม `lang` | `backend/src/utils/knowledgeProjection.ts`, `backend/src/utils/lang.ts` |
| Controllers | `knowledge.controller.ts`, `healthTips.controller.ts`, `i18n.controller.ts` |
| Prisma | `backend/prisma/schema.prisma` |
| Frontend API | `frontend/lib/api.ts` |
| หน้า knowledge / health-tips / home (I18N merge) | `frontend/app/[locale]/...` |

Checklist:

- [ ] Dry-run จับ `drug_ref` / `slug` / `tip_slug` ผิดจากแท็บอื่น
- [ ] `lang=en` คืนค่า EN หรือ fallback TH เมื่อ EN ว่าง
- [ ] Health tip แสดง markdown ถูก locale
- [ ] ป้าย Home จากชีท override ค่า static ได้เมื่อมี key ใน `I18N_UI`
