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
- **Candidate drugs:** Paracetamol (first line), Ibuprofen (if no NSAID contraindication).
- **Red flags:** worst headache of life, focal weakness, confusion, persistent vomiting, stiff neck, new-onset headache age > 50.

### 2.2 Common cold / mild URTI
- **Typical:** sneezing, runny nose, sore throat, low-grade fever, mild cough.
- **Possible condition:** viral URI, mild viral pharyngitis.
- **Candidate drugs:** Paracetamol (fever/pain), Chlorpheniramine (runny nose/sneeze).
- **Red flags:** dyspnea, high persistent fever > 48 h, chest pain, hemoptysis, severe sore throat with drooling.

### 2.3 Allergic rhinitis / itch (mild)
- **Typical:** sneezing, clear rhinorrhea, itchy nose/eyes, no systemic distress.
- **Candidate drugs:** Loratadine 10 mg (slot A3, non-sedating antihistamine).
- **Red flags:** wheeze/dyspnea, throat swelling, generalized urticaria with breathing symptoms → anaphylaxis protocol.

### 2.4 Mild diarrhea / gastroenteritis
- **Typical:** loose stool, no blood, mild cramps, no high fever, tolerating fluids.
- **Candidate drugs:** ORS for hydration (first line).
- **Red flags:** bloody stool, black tarry stool, severe dehydration (dizziness, no urine ≥ 8 h), high fever, severe abdominal pain, pregnancy.

### 2.5 Dyspepsia / heartburn (mild)
- **Typical:** burning epigastric discomfort after meals, no alarm features.
- **Candidate drugs:** Antacid (aluminum/magnesium hydroxide) — short term.
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
| `NSAID`, `nsaid`, `แก้อักเสบ` | Ibuprofen |
| `paracetamol`, `acetaminophen`, `พาราเซตามอล` | Paracetamol |
| `antihistamine`, `loratadine`, `ลอราทาดีน` | Loratadine (A3) |
| `dextromethorphan`, `dxm`, `ยาแก้ไอ` | Dextromethorphan cough (A4) |
| `antacid`, `aluminum hydroxide`, `magnesium hydroxide` | Antacid (B3) |
| `ORS`, `oral rehydration`, `เกลือแร่` | ORS (B2) |
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

### # Drug: Ibuprofen 400 mg (ไอบูโพรเฟน 400 มก.)

| Field | Value |
|---|---|
| **Common name (TH)** | ไอบูโพรเฟน 400 มก. |
| **Common name (EN)** | Ibuprofen 400 mg |
| **Active ingredient** | `ibuprofen` |
| **Drug class** | NSAID (non-selective COX inhibitor) |
| **Kiosk slot** | `A2` |
| **Category** | ยาแก้ปวด / ลดการอักเสบ |

**Indications**
- Inflammatory pain (musculoskeletal strain, dysmenorrhea, dental pain).
- Fever that is inadequately controlled by paracetamol (when NSAID not contraindicated).

**Contraindications**
- **NSAID allergy** (including aspirin-sensitive asthma) — absolute reject.
- Active peptic ulcer, GI bleeding history.
- Severe renal impairment (eGFR < 30).
- Decompensated heart failure.
- Pregnancy — avoid in 3rd trimester; caution at any trimester.
- Children < 6 months.

**Dosing (weight/age)**
- **Adult:** 200–400 mg every 6–8 h PRN with food. Max 1,200 mg/day OTC (higher requires physician).
- **Adolescent (12–17 yr):** 5–10 mg/kg every 6–8 h. Max 40 mg/kg/day.
- **Child (6 months–11 yr):** 5–10 mg/kg every 6–8 h — **kiosk does not dispense**, refer to pharmacist.
- **Elderly:** lowest effective dose, shortest duration; watch renal/GI risk.

**Warnings (side-effects)**
- GI: dyspepsia, ulceration, bleeding.
- Renal: acute kidney injury, fluid retention.
- Cardiovascular: increased MI/stroke risk with chronic use.
- Asthma exacerbation in aspirin-sensitive patients.

**Allergy / class keywords to match**
`ibuprofen`, `brufen`, `nsaid`, `ไอบูโพรเฟน`, `แพ้ยาแก้อักเสบ`, `aspirin`

---

### # Drug: Loratadine 10 mg (ลอราทาดีน 10 มก.) — slot A3

| Field | Value |
|---|---|
| **Kiosk slot** | `A3` |
| **Category** | ยาแก้แพ้ |
| **Active ingredient** | `loratadine` |
| **Indications** | Allergic rhinitis, urticaria, mild itch |
| **Contraindications** | Loratadine hypersensitivity; severe hepatic impairment |
| **Dosing** | Adult ≥12 yr: 10 mg once daily |
| **Warnings** | Less sedating than first-gen antihistamines; caution with hepatic disease |
| **Allergy keywords** | `loratadine`, `ลอราทาดีน`, `antihistamine` |

---

### # Drug: Dextromethorphan cough (ยาแก้ไอ) — slot A4

| Field | Value |
|---|---|
| **Kiosk slot** | `A4` |
| **Category** | ยาแก้ไอ |
| **Active ingredient** | `dextromethorphan` |
| **Indications** | Non-productive (dry) cough in adults |
| **Contraindications** | Age <6 yr; MAOI use; severe respiratory depression |
| **Dosing** | Adult: per label, q6–8h PRN |
| **Warnings** | Do not combine with other CNS depressants; avoid in productive cough needing expectoration |
| **Allergy keywords** | `dextromethorphan`, `dxm` |

---

### # Drug: Throat lozenges (ยาอมแก้เจ็บคอ) — slot A5

| Field | Value |
|---|---|
| **Kiosk slot** | `A5` |
| **Category** | ยาแก้ไอ / ลำคอ |
| **Active ingredients** | `benzocaine`, `menthol`, `eucalyptus` |
| **Indications** | Mild sore throat, throat irritation |
| **Contraindications** | Age <6 yr; benzocaine allergy |
| **Dosing** | Dissolve slowly q2–3h PRN |
| **Warnings** | Choking hazard in young children; max daily lozenges per label |
| **Allergy keywords** | `benzocaine`, `menthol`, `eucalyptus`, `ยาอม` |

---

### # Drug: Kaolin/pectin antidiarrheal (ยาธาตุน้ำขาว) — slot B1

| Field | Value |
|---|---|
| **Kiosk slot** | `B1` |
| **Category** | ยาระบบทางเดินอาหาร |
| **Active ingredients** | `bismuth`, `kaolin`, `pectin`, `attapulgite` |
| **Indications** | Mild acute diarrhea (non-bloody) |
| **Contraindications** | Bloody stool, high fever, severe dehydration, child <2 yr |
| **Dosing** | Per label after each loose stool |
| **Warnings** | Stop after 2 days if no improvement; refer if red flags |
| **Allergy keywords** | `bismuth`, `kaolin`, `pectin` |

---

### # Drug: ORS electrolyte (เกลือแร่ ORS) — slot B2

| Field | Value |
|---|---|
| **Kiosk slot** | `B2` |
| **Category** | ยาระบบทางเดินอาหาร |
| **Active ingredients** | `sodium`, `potassium`, `glucose`, `ors` |
| **Indications** | Mild dehydration from diarrhea/vomiting |
| **Contraindications** | Severe dehydration (IV needed), ileus, anuria |
| **Dosing** | Dissolve per sachet label; sip frequently |
| **Warnings** | Never over-concentrate; escalate if bloody stool or >48h |
| **Allergy keywords** | `ors`, `electrolyte`, `เกลือแร่` |

---

### # Drug: Antacid (ยาลดกรด แก้ท้องอืด) — slot B3

| Field | Value |
|---|---|
| **Kiosk slot** | `B3` |
| **Category** | ยาระบบทางเดินอาหาร |
| **Active ingredients** | `aluminium`, `magnesium`, `hydroxide`, `antacid` |
| **Indications** | Mild dyspepsia, heartburn |
| **Contraindications** | Severe renal impairment; GI obstruction |
| **Dosing** | 1–2 tabs after meals and bedtime |
| **Warnings** | Max 2 weeks without review; separate from tetracycline/iron by 2h |
| **Allergy keywords** | `antacid`, `magnesium`, `aluminium`, `ยาลดกรด` |

---

### # Drug: Tiger balm / topical analgesic (บalm นวด) — slot B4

| Field | Value |
|---|---|
| **Kiosk slot** | `B4` |
| **Category** | ยาทาภายนอก |
| **Active ingredients** | `menthol`, `camphor`, `methyl salicylate` |
| **Indications** | Musculoskeletal aches, mild pain |
| **Contraindications** | Open wounds, salicylate allergy, children <2 yr |
| **Dosing** | Thin layer to affected area 2–3×/day |
| **Warnings** | Avoid eyes/mucosa; wash hands after use; salicylate → NSAID cross-allergy |
| **Allergy keywords** | `menthol`, `camphor`, `methyl salicylate`, `salicylate` |

---

### # Drug: Vitamin C 1000 mg (วิตามินซี) — slot B5

| Field | Value |
|---|---|
| **Kiosk slot** | `B5` |
| **Category** | วิตามิน |
| **Active ingredient** | `ascorbic acid`, `vitamin c` |
| **Indications** | Vitamin C supplementation, immune support adjunct |
| **Contraindications** | Known oxalate kidney stone history — caution |
| **Dosing** | 1 tab daily with food |
| **Warnings** | High doses may cause GI upset; not a substitute for medical care |
| **Allergy keywords** | `ascorbic`, `vitamin c`, `วิตามินซี` |

---

## 6. Weight / age dosing quick reference

| Patient group | Paracetamol (A1) | Ibuprofen (A2) | Loratadine (A3) | ORS (B2) |
|---|---|---|---|---|
| Adult ≥ 50 kg | 500 mg–1 g q4–6 h (max 4 g/d) | 200–400 mg q6–8 h | 10 mg once daily | 200–400 mL per loose stool |
| Adolescent 12–17 yr | 15 mg/kg q4–6 h | 5–10 mg/kg q6–8 h | 10 mg once daily | 100–200 mL per loose stool |
| Child < 12 yr | weight-based → **refer** | **refer** | **refer** | weight-based → **refer** |
| Elderly ≥ 65 yr | max 3 g/d if frail | lowest dose; renal/GI caution | 10 mg daily; hepatic caution | monitor electrolytes |
| Pregnancy | preferred analgesic | avoid (esp. 3rd trimester) | consult clinician | generally safe if mild dehydration |

**"Refer" = kiosk cannot safely dispense; LaneYa must recommend seeing a pharmacist or doctor.**

---

## 7. Follow-up question bank (Phase 1)

When data is missing, the AI uses these Thai prompts:

- Age → `"ขอทราบอายุของคุณเพื่อประเมินยาที่เหมาะสมครับ/ค่ะ"`
- Weight → `"ขอทราบน้ำหนักตัวโดยประมาณ เพื่อคำนวณขนาดยาให้ปลอดภัยครับ/ค่ะ"`
- Allergies → `"เคยแพ้ยาอะไรบ้างครับ/ค่ะ? ถ้าไม่เคย บอกว่า 'ไม่มี' ได้เลย"`
- Underlying conditions → `"มีโรคประจำตัวอะไรบ้าง เช่น เบาหวาน ความดัน หอบหืด โรคไต โรคตับ?"`
- Current medications → `"ตอนนี้ทานยาอะไรประจำอยู่บ้างไหมครับ/ค่ะ?"`
- Pregnancy → `"คุณกำลังตั้งครรภ์หรือให้นมบุตรอยู่ไหมครับ/ค่ะ?"`

For symptom detail:
- Onset & duration — `"เป็นมากี่วัน/กี่ชั่วโมงแล้ว?"`
- Severity 0–10 — `"ถ้าให้คะแนนความรุนแรง 0–10 ประมาณเท่าไร?"`
- Associated symptoms — `"มีไข้ คลื่นไส้ อาเจียน หายใจลำบาก เจ็บหน้าอก ร่วมด้วยไหม?"`

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
- Drugs listed: **Paracetamol, Ibuprofen, Loratadine, Dextromethorphan, Throat lozenges, Antidiarrheal, ORS, Antacid, Tiger balm, Vitamin C**.
