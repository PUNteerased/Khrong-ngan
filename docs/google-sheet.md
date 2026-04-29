# Google Sheet Table Design (Knowledge + Health Tips + i18n)

เอกสารนี้เป็นสเปกสำหรับออกแบบตารางใน Google Sheet เพื่อให้ระบบ LaneYa สามารถ:
- ซิงค์คลังข้อมูล (โรค/อาการ/ยา/mapping)
- ซิงค์เกล็ดความรู้สุขภาพ
- รองรับข้อมูลสองภาษา (TH/EN)

## สรุปสั้นตามที่ใช้งานจริง

แกนหลักของข้อมูลสองภาษาในชีทคือ:
- `slug`
- ชื่อไทย / ชื่ออังกฤษ
- เนื้อหาไทย / เนื้อหาอังกฤษ

เมื่อผู้ใช้กดเปลี่ยนภาษา:
- ถ้าเลือก `th` ระบบจะแสดงคอลัมน์ไทย
- ถ้าเลือก `en` ระบบจะแสดงคอลัมน์อังกฤษ
- ถ้าคอลัมน์อังกฤษว่าง จะ fallback ไปค่าไทยอัตโนมัติ

ตัวอย่างแพตเทิร์นคอลัมน์:
- `title_th`, `title_en`
- `summary_th`, `summary_en`
- `content_md_th`, `content_md_en`

## 1) โครงแท็บที่ต้องมี

แท็บหลักที่ใช้งานอยู่:
- `Disease`
- `Symptom`
- `Drug`
- `Map_Disease_Symptom`
- `Map_Disease_Drug`
- `Map_Symptom_Drug`
- `HealthTip`
- `HealthTip_Ref`

แท็บสำหรับ UI translation (แนะนำเพิ่ม):
- `I18N_UI`

## 2) Header ที่ต้องใช้ในแต่ละแท็บ

## 2.1 `Disease`

```csv
slug,name_th,name_en,definition,severity_level,self_care_advice,red_flag_advice,keywords,published
```

## 2.2 `Symptom`

```csv
slug,name_th,name_en,observation_guide,first_aid,danger_level,red_flag,keywords,published
```

## 2.3 `Drug`

```csv
drug_ref,slug,generic_name,brand_name,indication,contraindications,dose_by_age_weight,knowledge_priority,keywords,published
```

## 2.4 `Map_Disease_Symptom`

```csv
disease_slug,symptom_slug,relevance_score,note
```

## 2.5 `Map_Disease_Drug`

```csv
disease_slug,drug_ref,recommendation_level,note
```

## 2.6 `Map_Symptom_Drug`

```csv
symptom_slug,drug_ref,recommendation_level,note
```

## 2.7 `HealthTip`

```csv
slug,title_th,title_en,summary_th,summary_en,content_md_th,content_md_en,keywords,category,cover_image_url,published
```

คอลัมน์หลักที่ต้องมีขั้นต่ำสำหรับการสลับภาษา:
- `slug`
- `title_th`, `title_en`
- `content_md_th`, `content_md_en`

## 2.8 `HealthTip_Ref`

```csv
tip_slug,ref_title,ref_url,ref_publisher,accessed_at,note,published
```

## 2.9 `I18N_UI` (แนะนำ)

```csv
namespace,key,th,en,published,updated_by,updated_at
```

---

## 3) ตัวอย่างข้อมูลขั้นต่ำ

## 3.1 ตัวอย่าง `HealthTip`

```csv
slug,title_th,title_en,summary_th,summary_en,content_md_th,content_md_en,keywords,category,cover_image_url,published
paracetamol-safe-use,พาราเซตามอลใช้อย่างไรให้ปลอดภัย,How to use paracetamol safely,ใช้เมื่อมีไข้หรือปวด แต่ต้องไม่เกินขนาด,Use for fever/pain and avoid overdose,"## วิธีใช้
- ผู้ใหญ่ 500 mg ทุก 4-6 ชั่วโมง
## ข้อควรระวัง
- ห้ามเกิน 4,000 mg/วัน","## How to use
- Adults 500 mg every 4-6 hours
## Cautions
- Do not exceed 4,000 mg/day",พาราเซตามอล,การใช้ยา,,TRUE
```

## 3.2 ตัวอย่าง `HealthTip_Ref`

```csv
tip_slug,ref_title,ref_url,ref_publisher,accessed_at,note,published
paracetamol-safe-use,Paracetamol usage guidance,https://www.nhs.uk/medicines/paracetamol/,NHS,2026-04-29,reference for max dose,TRUE
```

## 3.3 ตัวอย่าง `I18N_UI`

```csv
namespace,key,th,en,published,updated_by,updated_at
Home,ctaChat,เริ่มปรึกษาอาการกับ AI,Start AI symptom consult,TRUE,admin,2026-04-29
Knowledge,tabDrug,ยา,Drug,TRUE,admin,2026-04-29
```

---

## 4) Data Validation ที่แนะนำใน Google Sheets

- `published`: dropdown = `TRUE,FALSE`
- `slug`, `tip_slug`, `disease_slug`, `symptom_slug`:
  - รูปแบบ `kebab-case`
  - ห้ามเว้นวรรค
- `HealthTip_Ref.tip_slug`: ตั้ง dropdown from range จาก `HealthTip!A2:A`
- `Map_*`:
  - `disease_slug` อ้างจาก `Disease!A2:A`
  - `symptom_slug` อ้างจาก `Symptom!A2:A`
  - `drug_ref` อ้างจาก `Drug!A2:A`
- `ref_url`: ต้องขึ้นต้นด้วย `http://` หรือ `https://`
- `knowledge_priority`, `relevance_score`: ต้องเป็นตัวเลข

---

## 5) Mapping กับ backend env

กำหนดชื่อแท็บให้ตรงกับระบบ (ถ้าชื่อจริงต่างจากค่า default):

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

5. ตรวจผลบนหน้าเว็บ:
- `/knowledge`
- `/health-tips`
- `/health-tips/[slug]`
- `/api/i18n/ui?namespace=Home`

---

## 7) ตรวจเทียบกับโค้ด (Verification)

รายการนี้ยืนยันว่าเอกสารฉบับนี้สอดคล้องกับโค้ดปัจจุบัน:

- Sync logic และชื่อแท็บ: `backend/src/services/knowledgeSheetSync.service.ts`
  - รองรับ `HealthTip`, `HealthTip_Ref`, `I18N_UI`
- ตารางฐานข้อมูล:
  - `KnowledgeHealthTip`, `KnowledgeHealthTipReference`, `UiTranslation`
  - ไฟล์: `backend/prisma/schema.prisma`
- API endpoints:
  - `GET /api/health-tips/search`
  - `GET /api/health-tips/:slug`
  - `GET /api/i18n/ui`
  - ไฟล์: `backend/src/routes/index.ts`
- หน้าเว็บที่ใช้ข้อมูลสองภาษา:
  - `frontend/app/[locale]/page.tsx`
  - `frontend/app/[locale]/health-tips/page.tsx`
  - `frontend/app/[locale]/health-tips/[slug]/page.tsx`
  - `frontend/app/[locale]/knowledge/page.tsx`

