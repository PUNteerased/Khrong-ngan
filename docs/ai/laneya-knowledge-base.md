# LaneYa Knowledge Base — RAG Source of Truth

> **Purpose.** This document is the single source of truth retrieved by the LaneYa AI (Dify Knowledge / RAG) when it recommends OTC medicine from the kiosk.
> **Audience.** The *AI*, not the patient. Patient-facing text is always synthesized in Thai by the model from this KB.
> **Scope.** Low-acuity OTC symptom care only. Anything outside this scope must trigger hospital escalation — see §3.
> **Authority.** Every drug row here must match an actual row in the backend `Drug` table (`slotId`, `name`, `ingredientsText`, `quantity`). If the backend and this file disagree, **the backend wins**.

---

## Table of contents

1. Canonical inventory contract
2. Symptom → condition triage map
3. Red-flag escalation matrix
4. Drug safety rules (how to reject a candidate)
5. Drug monographs (10 OTCs A1–B5) — the RAG payload
6. Weight/age dosing tables
7. Follow-up question bank (Phase 1)
8. Deterministic backend cross-check
9. Dify / retrieval setup tips

---

## 1. Canonical inventory contract

The AI may only recommend a drug that satisfies **all** of:

```
drug.id     ∈ {{inventory_drugs}}
drug.quantity > 0
candidate ingredients ∩ user_allergy_keywords == ∅
candidate contraindications ∩ user_conditions == ∅
```

Each inventory row the backend sends to the model must contain at least:

| Field | Type | Use |
|---|---|---|
| `id` | string | Internal identifier |
| `name` | string | Localized display name |
| `slotId` | string | Physical kiosk slot, e.g. `A1` |
| `category` | string | e.g. `ยาแก้ปวด`, `ยาแก้แพ้` |
| `description` | string | Indication summary |
| `ingredientsText` | string | Comma-separated active ingredients (for SafetyCheck) |
| `dosageNotes` | string | Human-readable dosing guidance |
| `warnings` | string | Contraindications / cautions |
| `quantity` | number | Stock on hand; treat `<=0` as unavailable |

If `quantity <= 0`, the drug is **not recommendable** this conversation even if symptoms match.

---

## 2. Symptom → condition triage map

Use only for **preliminary** triage. Never present as a diagnosis.

### 2.1 Mild headache
- **Typical:** bilateral, dull, no neurologic deficits, no recent head trauma.
- **Possible condition:** tension-type headache, minor viral illness.
- **Candidate drugs:** Paracetamol (A1, first line).
- **Red flags:** worst headache of life, focal weakness, confusion, persistent vomiting, stiff neck, new-onset headache age > 50.

### 2.2 Common cold / mild URTI
- **Typical:** sneezing, runny nose, sore throat, low-grade fever, mild cough.
- **Possible condition:** viral URI, mild viral pharyngitis.
- **Candidate drugs:** Paracetamol (A1, fever/pain), Chlorpheniramine (A3, runny nose), Andrographis (B3, sore throat adjunct).
- **Red flags:** dyspnea, high persistent fever > 48 h, chest pain, hemoptysis, severe sore throat with drooling.

### 2.3 Allergic rhinitis / itch (mild)
- **Typical:** sneezing, clear rhinorrhea, itchy nose/eyes, no systemic distress.
- **Candidate drugs:** Chlorpheniramine (A3, slot in kiosk).
- **Red flags:** wheeze/dyspnea, throat swelling, generalized urticaria with breathing symptoms → anaphylaxis protocol.

### 2.4 Mild diarrhea / gastroenteritis
- **Typical:** loose stool, no blood, mild cramps, no high fever, tolerating fluids.
- **Candidate drugs:** Activated charcoal capsules (A5) for non-bloody diarrhea; Simethicone (A2) for bloating.
- **Red flags:** bloody stool, black tarry stool, severe dehydration (dizziness, no urine ≥ 8 h), high fever, severe abdominal pain, pregnancy.

### 2.5 Dyspepsia / heartburn (mild)
- **Typical:** burning epigastric discomfort after meals, no alarm features.
- **Candidate drugs:** Simethicone (A2) — short term; Turmeric (B4) for dyspepsia adjunct.
- **Red flags:** weight loss, dysphagia, GI bleeding, vomiting blood, anemia, night pain, age > 50 new-onset.

---

## 3. Red-flag escalation matrix

If **any** red flag is detected, the AI must:

1. Refuse to recommend a drug.
2. Output only the red-flag response template (see system prompt).
3. Set `severity = "escalate_hospital"` and `next_action = "refer_hospital"`.
4. Instruct the patient to **call 1669** or go to the nearest ER.

Red flags (not exhaustive):

- Chest pain/pressure, radiating arm or jaw pain.
- Shortness of breath, respiratory distress, cyanosis.
- Altered mental status, confusion, seizure, syncope, stroke signs.
- Severe dehydration, signs of sepsis (high fever + shaking + altered consciousness).
- Vomiting blood, melena, severe unrelenting abdominal pain.
- Signs of anaphylaxis.
- Pregnancy with bleeding, severe pain, or decreased fetal movement.
- Infant < 3 months with fever, or elderly/child with moderate-severe symptoms.
- Self-harm or suicidal ideation.

---

## 4. Drug safety rules — how the AI rejects a candidate

For every candidate drug `D` considered for recommendation, evaluate in order:

1. **Allergy conflict** — compare `D.ingredientsText` tokens with user allergy keywords.
   Bi-directional substring match (`ingredient.includes(allergen)` OR vice versa).
   If hit → reject.
2. **Drug class allergy** — if user allergy is a class name (e.g. `"NSAID"`, `"penicillin"`, `"sulfa"`) and drug belongs to that class, reject even if the ingredient string doesn't literally match.
3. **Underlying condition conflict** — match user conditions against `D.warnings`. Reject if contraindicated.
4. **Drug–drug interaction** — scan user's current medications for overlap with D (same ingredient → duplicate therapy) or interaction list below.
5. **Age/weight appropriateness** — see §6. Outside safe range → reject or defer.
6. **Inventory availability** — `id ∈ inventory` and `quantity > 0`.

If all candidates fail → escalate (ask to consult a pharmacist/doctor).

**Common drug-class shortcuts the AI must know:**

| Class / keyword | Drugs in this KB that match |
|---|---|
| `NSAID`, `nsaid`, `แก้อักเสบ` | *(not in kiosk — off-kiosk only)* |
| `paracetamol`, `acetaminophen`, `พาราเซตามอล`, `พารา` | Paracetamol (A1) |
| `simethicone`, `ไซเมทิโคน`, `air-x` | Simethicone (A2) |
| `chlorpheniramine`, `cpm`, `antihistamine`, `ยาแก้แพ้` | Chlorpheniramine (A3) |
| `dimenhydrinate`, `เมารถ` | Dimenhydrinate (A4) |
| `activated charcoal`, `ถ่าน`, `ผงถ่าน` | Activated Charcoal (A5) |
| `cough`, `dextromethorphan`, `ยาแก้ไอ` | Cough syrup (B1) |
| `decongestant`, `pseudoephedrine`, `ลดน้ำมูก` | Nasal decongestant (B2) |
| `andrographis`, `ฟ้าทะลายโจร` | Andrographis (B3) |
| `turmeric`, `curcuma`, `ขมิ้นชัน` | Turmeric (B4) |
| `ascorbic acid`, `vitamin c`, `วิตามินซี` | Vitamin C (B5) |

---

## 5. Drug monographs (RAG payload)

Each monograph is chunkable as a single RAG document. Keep the `# Drug:` heading so retrieval ranks cleanly.

---

### # Drug: Paracetamol 500 mg (พาราเซตามอล 500 มก.)

| Field | Value |
|---|---|
| **Common name (TH)** | พาราเซตามอล 500 มก. |
| **Common name (EN)** | Paracetamol 500 mg |
| **Active ingredient** | `paracetamol` (a.k.a. `acetaminophen`) |
| **Drug class** | Non-opioid analgesic / antipyretic |
| **Kiosk slot** | `A1` |
| **Category** | ยาแก้ปวด / ลดไข้ |

**Indications**
- Mild-to-moderate pain (headache, myalgia, menstrual pain).
- Fever reduction.
- Safe first choice when NSAIDs are contraindicated.

**Contraindications / cautions**
- Known hypersensitivity to paracetamol / acetaminophen.
- Severe hepatic impairment (Child-Pugh C).
- Chronic heavy alcohol use — reduce max dose.
- G6PD deficiency — use standard doses cautiously.

**Dosing (weight/age)**
- **Adult (≥ 12 yr, ≥ 50 kg):** 500 mg–1 g every 4–6 h PRN. Max **4 g/day**.
- **Adolescent (12–17 yr, < 50 kg):** 15 mg/kg every 4–6 h. Max 60 mg/kg/day, not to exceed 3 g/day.
- **Child (≥ 6 yr):** 10–15 mg/kg every 4–6 h. Max 5 doses / 24 h.
- **Child < 6 yr or < 20 kg:** defer to pharmacist — LaneYa does not dispense pediatric syrup from kiosk.
- **Elderly (≥ 65 yr):** use lower end of range, consider max 3 g/day if frail or low body weight.

**Warnings (side-effects)**
- Hepatotoxicity on overdose — do **not** combine with other paracetamol-containing products.
- Rare: Stevens–Johnson syndrome, hypersensitivity rash.

**Allergy / class keywords to match**
`paracetamol`, `acetaminophen`, `tylenol`, `พาราเซตามอล`, `พารา`

---

### # Drug: Simethicone (ยาไซเมทิโคน) — slot A2

| Field | Value |
|---|---|
| **Formal name (TH)** | ยาไซเมทิโคน |
| **Common name (TH)** | แอร์-เอ็กซ์ |
| **Generic (EN)** | Simethicone |
| **Kiosk slot** | `A2` |
| **Category** | ยาระบบทางเดินอาหาร |
| **Indications** | Bloating, flatulence, abdominal distension |
| **Contraindications** | Known hypersensitivity |
| **Dosing** | Adult: per label after meals |
| **Warnings** | If symptoms >2 weeks, refer |
| **Allergy keywords** | `simethicone`, `ไซเมทิโคน`, `air-x` |

---

### # Drug: Chlorpheniramine (ยาคลอร์เฟนิรามีน) — slot A3

| Field | Value |
|---|---|
| **Formal name (TH)** | ยาคลอร์เฟนิรามีน |
| **Common name (TH)** | แก้แพ้ แก้คัน |
| **Generic (EN)** | Chlorpheniramine Maleate (CPM) |
| **Kiosk slot** | `A3` |
| **Category** | ยาแก้แพ้ |
| **Indications** | Allergic rhinitis, urticaria, itch, runny nose |
| **Contraindications** | Glaucoma, urinary retention, severe asthma attack |
| **Dosing** | Adult: 4 mg q4–6h; max 24 mg/day |
| **Warnings** | Drowsiness — do not drive |
| **Allergy keywords** | `chlorpheniramine`, `cpm`, `antihistamine` |

---

### # Drug: Dimenhydrinate (ยาไดเมนไฮดริเนต) — slot A4

| Field | Value |
|---|---|
| **Formal name (TH)** | ยาไดเมนไฮดริเนต |
| **Common name (TH)** | เมารถ |
| **Generic (EN)** | Dimenhydrinate |
| **Kiosk slot** | `A4` |
| **Category** | ยาแก้เมารถ |
| **Indications** | Motion sickness, nausea, vomiting |
| **Contraindications** | Glaucoma, children <2 yr without clinician advice |
| **Dosing** | Adult: 50 mg q4–6h before travel, per label |
| **Warnings** | Sedation; avoid alcohol |
| **Allergy keywords** | `dimenhydrinate`, `dramamine`, `เมารถ` |

---

### # Drug: Activated Charcoal (ผงถ่านกัมมันต์) — slot A5

| Field | Value |
|---|---|
| **Formal name (TH)** | ผงถ่านกัมมันต์ชนิดแคปซูล |
| **Common name (TH)** | ผงถ่าน |
| **Generic (EN)** | Activated Charcoal |
| **Kiosk slot** | `A5` |
| **Category** | ยาระบบทางเดินอาหาร |
| **Indications** | Non-bloody acute diarrhea, adsorption adjunct |
| **Contraindications** | Bloody stool, high fever, ileus, altered consciousness |
| **Dosing** | Per label after each loose stool |
| **Warnings** | Max 2 days without improvement → refer |
| **Allergy keywords** | `activated charcoal`, `charcoal`, `ถ่าน`, `ผงถ่าน` |

---

### # Drug: Cough syrup (ยาแก้ไอขับเสมหะ) — slot B1

| Field | Value |
|---|---|
| **Formal name (TH)** | ยาบรรเทาอาการไอขับเสมหะ |
| **Common name (TH)** | แก้ไอ |
| **Generic (EN)** | Cough Syrup / Antitussives |
| **Kiosk slot** | `B1` |
| **Category** | ยาแก้ไอ |
| **Indications** | Dry or productive cough (per formulation) |
| **Contraindications** | Age <6 yr; MAOI; severe respiratory depression |
| **Dosing** | Adult: per label q6–8h |
| **Warnings** | Check dextromethorphan vs guaifenesin on label |
| **Allergy keywords** | `dextromethorphan`, `guaifenesin`, `cough`, `dxm` |

---

### # Drug: Nasal decongestant (ยาลดน้ำมูก) — slot B2

| Field | Value |
|---|---|
| **Formal name (TH)** | ยาลดน้ำมูกและบรรเทาอาการคัดจมูก |
| **Common name (TH)** | ลดน้ำมูก |
| **Generic (EN)** | Nasal Decongestants |
| **Kiosk slot** | `B2` |
| **Category** | ยาแก้หวัด |
| **Indications** | Nasal congestion, rhinorrhea |
| **Contraindications** | Uncontrolled hypertension, MAOI |
| **Dosing** | Per label; max 7 days continuous use |
| **Warnings** | Rebound congestion if overused |
| **Allergy keywords** | `pseudoephedrine`, `phenylephrine`, `decongestant` |

---

### # Drug: Andrographis (ฟ้าทะลายโจร) — slot B3

| Field | Value |
|---|---|
| **Formal name (TH)** | สารสกัดฟ้าทะลายโจร |
| **Common name (TH)** | ฟ้าทะลายโจร |
| **Generic (EN)** | Andrographis paniculata |
| **Kiosk slot** | `B3` |
| **Category** | ยาสมุนไพร |
| **Indications** | Common cold symptoms, sore throat adjunct |
| **Contraindications** | Pregnancy — caution |
| **Dosing** | Per label 2–3×/day |
| **Warnings** | GI upset if overdose |
| **Allergy keywords** | `andrographis`, `ฟ้าทะลายโจร` |

---

### # Drug: Turmeric (ขมิ้นชัน) — slot B4

| Field | Value |
|---|---|
| **Formal name (TH)** | ผงขมิ้นชันแคปซูล |
| **Common name (TH)** | ขมิ้นชัน |
| **Generic (EN)** | Curcuma longa (Turmeric) |
| **Kiosk slot** | `B4` |
| **Category** | ยาสมุนไพร |
| **Indications** | Dyspepsia, bloating, flatulence adjunct |
| **Contraindications** | Gallstones — caution; anticoagulant use |
| **Dosing** | 1–2 caps after meals |
| **Warnings** | Drug interaction with warfarin |
| **Allergy keywords** | `turmeric`, `curcuma`, `curcumin`, `ขมิ้นชัน` |

---

### # Drug: Vitamin C (กรดแอสคอร์บิก) — slot B5

| Field | Value |
|---|---|
| **Formal name (TH)** | กรดแอสคอร์บิก (วิตามินซี) |
| **Common name (TH)** | วิตามินซี |
| **Generic (EN)** | Ascorbic Acid (Vitamin C) |
| **Kiosk slot** | `B5` |
| **Category** | วิตามิน |
| **Indications** | Vitamin C supplementation |
| **Contraindications** | Renal oxalate stones — caution |
| **Dosing** | 1 tab daily with food |
| **Warnings** | Not a substitute for medical care |
| **Allergy keywords** | `ascorbic`, `vitamin c`, `วิตามินซี` |

---

## 6. Weight / age dosing quick reference

| Patient group | Paracetamol (A1) | CPM (A3) | Simethicone (A2) |
|---|---|---|---|
| Adult ≥ 12 yr | 500 mg–1 g q4–6 h (max 4 g/d) | 4 mg q4–6 h (max 24 mg/d) | per label |
| Child < 12 yr | weight-based → **refer** | **refer** | **refer** |
| Elderly ≥ 65 yr | max 3 g/d if frail | lower dose; fall risk | per label |
| Pregnancy | preferred analgesic | consult clinician | generally OK short-term |

**"Refer" = kiosk cannot safely dispense; LaneYa must recommend seeing a pharmacist or doctor.**

---

## 7. Follow-up question bank (Phase 1)

When data is missing, the AI asks **at most 2 fields per turn** using these Thai prompts (male voice, ครับ/นะครับ):

- Age → `"อายุเท่าไหร่ครับ (ปี)"`
- Weight → `"น้ำหนักประมาณเท่าไหร่ครับ (กก.)"`
- Allergies → `"เคยแพ้ยาอะไรบ้างครับ? ถ้าไม่เคย บอกว่า 'ไม่มี' ได้เลย"`
- Underlying conditions → `"มีโรคประจำตัวอะไรบ้างครับ เช่น เบาหวาน ความดัน ถ้าไม่มีบอก 'ไม่มี'"`
- Current medications → `"ตอนนี้ทานยาประจำอะไรอยู่ไหมครับ?"`
- Pregnancy → `"กำลังตั้งครรภ์หรือให้นมบุตรอยู่ไหมครับ?"`

For symptom detail (max 2 questions per turn):
- Main complaint — `"ช่วยเล่าอาการหลักให้ฟังหน่อยครับ — เช่น ปวดหัว เป็นไข้ หรือไอ"`
- Onset & severity — `"เป็นมานานแค่ไหนแล้วครับ ประมาณ 0–10 รู้สึกหนักแค่ไหน"`

---

## 8. Deterministic backend cross-check

The AI's JSON output is **re-validated** by the backend before any QR ticket is issued. Pseudo-code:

```ts
// matches backend/src/lib/safetyCheck.ts
if (!recommendedDrug)                         reject("NO_DRUG_SELECTED")
if (!inventory.has(recommendedDrug.id))       reject("NOT_IN_INVENTORY")
if (recommendedDrug.quantity <= 0)            reject("OUT_OF_STOCK")

const allergyKw = parseAllergyKeywords(user) // from User.allergyKeywords ?? allergiesText
const safety = checkDrugSafety({
  userAllergyKeywords: allergyKw,
  drugIngredientsText: recommendedDrug.ingredientsText,
})
if (!safety.isSafe)                           reject("ALLERGY_CONFLICT", safety.matchedAllergies)

if (matchesContraindication(user.diseasesText, recommendedDrug))
                                              reject("CONDITION_CONFLICT")

if (!doseIsValidForAgeWeight(user.age, user.weight, recommendedDose))
                                              reject("DOSE_NOT_SAFE")
```

QR is issued only when every check passes.

---

## 9. Dify / retrieval setup tips

- **Retrieval mode:** Hybrid (BM25 + vector).
- **Chunking:** 300–600 tokens, overlap 50–80. Keep each `# Drug:` monograph as one chunk if possible.
- **Weighting:** boost `red_flag`, `contraindication`, and `allergy` sections — these must retrieve first.
- **Metadata tags:** `symptom`, `red_flag`, `drug`, `contraindication`, `dosage`, `age:adult|child|elderly`, `pregnancy`.
- **Suggested split** (one doc per file for cleaner retrieval):
  1. `kb-triage-common-conditions.md` — §2
  2. `kb-red-flags.md` — §3 (high retrieval weight)
  3. `kb-drug-monographs.md` — §5 (one per drug)
  4. `kb-dosing-tables.md` — §6
  5. `kb-followup-questions.md` — §7

---

## Version

- `laneya-knowledge-base.md` · v3.0
- Aligned with backend `Drug` slots A1–B5 (10 OTCs), `safetyCheck.ts`, and `PickupTicket` QR flow.
- Drugs listed: **Paracetamol, Simethicone, Chlorpheniramine, Dimenhydrinate, Activated Charcoal, Cough syrup, Nasal decongestant, Andrographis, Turmeric, Vitamin C** (A1–B5).
