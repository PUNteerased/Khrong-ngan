# LaneYa Knowledge Base (Rebuild Draft)

This file is designed for importing into Dify Knowledge (or splitting into multiple documents).  
Scope: common OTC use-cases only for kiosk dispensing.

---

## 1) Inventory Canonical Source (Must Match Backend)

AI must only use medicines from current inventory table in backend (`Drug`).

Required fields for each entry:
- `name`
- `slotId`
- `category`
- `description`
- `dosageNotes`
- `warnings`
- `quantity`

If `quantity <= 0`, AI must treat item as unavailable.

---

## 2) Symptom-to-Condition (Basic Triage Map)

Use only as preliminary triage, not definitive diagnosis.

### 2.1 Mild Headache
- Typical: bilateral headache, no neuro deficits, no trauma
- Possible condition: tension headache / minor viral illness
- Red flags: worst headache of life, focal weakness, confusion, persistent vomiting

### 2.2 Common Cold / URTI (Mild)
- Typical: runny nose, sore throat, low fever, mild cough
- Possible condition: common cold, mild viral pharyngitis
- Red flags: dyspnea, high persistent fever, chest pain

### 2.3 Mild Diarrhea
- Typical: loose stool, no blood, mild abdominal discomfort
- Possible condition: acute non-severe gastroenteritis
- Red flags: severe dehydration, blood in stool, persistent vomiting, severe abdominal pain

### 2.4 Allergic Rhinitis (Mild)
- Typical: sneezing, runny nose, itchy nose/eyes, no severe breathing distress
- Red flags: wheeze/dyspnea, throat swelling, generalized urticaria with breathing symptoms

---

## 3) Red Flag Escalation Matrix

If any found -> `severity = escalate_hospital`, no kiosk dispensing:

- Chest pain / pressure
- Shortness of breath / respiratory distress
- Altered mental status / confusion / seizure
- Severe dehydration signs
- High-risk bleeding symptoms
- Severe allergic reaction/anaphylaxis signs
- Pregnancy + warning symptoms
- Elderly/children with moderate-severe symptoms

---

## 4) Drug Safety Rules (Template)

For each candidate drug, evaluate:

1. Allergy conflict  
   - If patient allergy text suggests same class/ingredient -> reject
2. Underlying condition conflict  
   - If known contraindication with patient condition -> reject
3. Age/weight appropriateness  
   - If outside safe profile -> reject or ask pharmacist
4. Inventory availability  
   - Must exist and in-stock

If rejected, choose safer alternative from inventory.  
If no safe alternative exists, escalate.

---

## 5) Suggested Medicine Knowledge Entries (Template Rows)

> IMPORTANT: Replace these with your actual formulary facts and approved local guidance.

### Paracetamol 500 mg
- Use: fever, mild pain
- Typical adult dose: 500 mg every 6-8 hours as needed
- Max: do not exceed local daily max policy
- Caution: chronic liver disease, alcohol overuse
- Avoid if: known paracetamol allergy

### Ibuprofen 400 mg
- Use: inflammatory pain, fever
- Typical adult dose: every 8 hours with food (per local policy)
- Caution: gastritis/ulcer history, kidney disease, asthma sensitivity to NSAIDs
- Avoid if: NSAID allergy, high-risk GI bleed, severe renal risk

### Loratadine
- Use: allergic symptoms
- Typical dose: once daily (per local policy)
- Caution: severe persistent symptoms may require physician evaluation

### ORS / Antidiarrheal Support
- Use: mild diarrhea support and hydration
- Caution: bloody stool, high fever, severe dehydration -> hospital

---

## 6) Follow-up Question Bank (for Phase 1)

When data missing:
- "ขอทราบอายุปัจจุบันเพื่อประเมินความปลอดภัยของยาได้ถูกต้องครับ"
- "ขอทราบน้ำหนักตัวโดยประมาณเพื่อคำนวณขนาดยาให้เหมาะสมครับ"
- "มีโรคประจำตัวอะไรบ้าง เช่น เบาหวาน ความดัน หอบหืด ไต ตับ ครับ"
- "เคยแพ้ยาอะไรบ้าง หรือมีอาการแพ้ยาแบบไหนครับ"

For symptom detail:
- Onset/duration
- Severity scale
- Associated symptoms
- Any red-flag signs

---

## 7) Deterministic Backend Cross-Check (Recommended)

AI output must be validated in backend before dispense:

Pseudo-rule examples:

```ts
if (!recommendedDrug) reject("NO_DRUG_SELECTED")
if (!inventory.includes(recommendedDrug.id)) reject("NOT_IN_INVENTORY")
if (recommendedDrug.quantity <= 0) reject("OUT_OF_STOCK")

if (matchesAllergy(user.allergiesText, recommendedDrug)) {
  reject("ALLERGY_CONFLICT")
}

if (matchesContraindication(user.diseasesText, recommendedDrug)) {
  reject("CONDITION_CONFLICT")
}

if (!doseIsValidForAgeWeight(user.age, user.weight, recommendedDose)) {
  reject("DOSE_NOT_SAFE")
}
```

Only allow QR issuing when all checks pass.

---

## 8) Final Response Policy

Every final response must contain:
- Preliminary condition assessment
- Recommended medicine (if safe)
- How to use (clear dose/frequency)
- Safety confirmation statement
- Warning signs requiring hospital

If unsafe:
- Explicitly deny dispensing
- Explain risk
- Give emergency escalation instruction

---

## 9) Dify Setup Tips

- Retrieval mode: Hybrid search
- Chunking: 300-600 tokens, overlap 50-80
- Priority: red-flag and safety docs should have higher retrieval weight
- Metadata tags: `symptom`, `red_flag`, `drug`, `contraindication`, `dosage`

Recommended split into 4 docs:
1. `triage-common-conditions.md`
2. `red-flags-and-escalation.md`
3. `drug-safety-and-dosage.md`
4. `workflow-and-json-contract.md`

