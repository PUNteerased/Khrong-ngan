# Google Sheets Data Validation (LaneYa Knowledge)

Use this checklist to prevent sync errors before running Dry-run.

## 1) Required tabs

Create tabs with exact names:

- `Disease`
- `Symptom`
- `Drug`
- `Map_Disease_Symptom`
- `Map_Disease_Drug`
- `Map_Symptom_Drug`

## 2) Required headers

### Disease

`slug,name_th,name_en,definition,severity_level,self_care_advice,red_flag_advice,keywords,published`

### Symptom

`slug,name_th,name_en,observation_guide,first_aid,danger_level,red_flag,keywords,published`

### Drug

`drug_ref,slug,generic_name,brand_name,indication,contraindications,dose_by_age_weight,knowledge_priority,keywords,published`

### Map_Disease_Symptom

`disease_slug,symptom_slug,relevance_score,note`

### Map_Disease_Drug

`disease_slug,drug_ref,recommendation_level,note`

### Map_Symptom_Drug

`symptom_slug,drug_ref,recommendation_level,note`

## 3) Add dropdown validation (recommended)

Use Google Sheets: **Data > Data validation**.

### Mapping tab dropdowns

- `Map_Disease_Symptom.disease_slug` -> **Dropdown from range**: `Disease!A2:A`
- `Map_Disease_Symptom.symptom_slug` -> `Symptom!A2:A`
- `Map_Disease_Drug.disease_slug` -> `Disease!A2:A`
- `Map_Disease_Drug.drug_ref` -> `Drug!A2:A`
- `Map_Symptom_Drug.symptom_slug` -> `Symptom!A2:A`
- `Map_Symptom_Drug.drug_ref` -> `Drug!A2:A`

### Boolean / enum dropdowns

- `published` -> dropdown: `true,false`
- `red_flag` -> dropdown: `true,false`
- `severity_level` -> dropdown: `ROUTINE,ESCALATE_HOSPITAL`
- `danger_level` -> dropdown: `LOW,MEDIUM,HIGH`
- `recommendation_level` -> dropdown: `SUGGESTED,ALTERNATIVE,AVOID`

## 4) Slug rules

- lowercase
- kebab-case
- unique per tab
- do not rename published slugs frequently (treat as stable IDs)

## 5) Numeric rules

- `knowledge_priority` must be integer
- `relevance_score` must be integer

## 6) Sync workflow

1. Edit sheet
2. Run **Dry-run**
3. Fix all errors
4. Run **Sync now**
5. Check **Recent sync runs** and **Last Successful Sync**

