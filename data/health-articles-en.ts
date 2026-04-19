import type { HealthArticle } from "./health-articles"

/** English versions of static health articles (same slugs as Thai). */
export const healthArticlesEn: HealthArticle[] = [
  {
    slug: "paracetamol-safe-use",
    title: "Five tips for using paracetamol safely",
    excerpt:
      "Paracetamol (acetaminophen) is widely used for fever and pain. Correct use lowers liver risk and side effects.",
    category: "Medication use",
    paragraphs: [
      "Paracetamol works well for pain and fever when taken at appropriate doses. Taking too much or combining it with other medicines that contain the same ingredient can harm the liver.",
      "Read the label every time, compare ingredients with other medicines you take (for example cold remedies), stay within the maximum daily dose, and avoid regular heavy alcohol use with this medicine unless your clinician advises otherwise.",
    ],
    highlights: [
      "Follow the label or prescription—do not increase the dose on your own.",
      "Space doses as directed; do not take doses too close together.",
      "If you have liver disease, drink alcohol regularly, or are pregnant, ask a clinician before use.",
      "Keep medicines away from children and do not use expired products.",
    ],
    references: [
      {
        title: "Paracetamol — patient information",
        source: "National Health Service (NHS), United Kingdom",
        url: "https://www.nhs.uk/medicines/paracetamol-for-adults/",
      },
      {
        title: "Rational use of medicines (Thai Ministry of Public Health)",
        source: "Department of Disease Control, Thailand",
        url: "https://ddc.moph.go.th/",
      },
    ],
  },
  {
    slug: "influenza-self-care",
    title: "Self-care when you have influenza",
    excerpt:
      "Influenza often causes fatigue, body aches, and fever. Rest and fluids are key to recovery.",
    category: "Infectious disease",
    paragraphs: [
      "Influenza symptoms often start suddenly—fever, muscle aches, headache, tiredness, and sometimes cough or sore throat. Staying home reduces spread and gives your immune system time to respond.",
      "Drink clean water, diluted juice, or warm soup to prevent dehydration. Seek urgent care if breathing is difficult, you become very drowsy, or a high fever lasts many days without improvement.",
    ],
    highlights: [
      "Use separate utensils and wear a mask when near others.",
      "Wash hands often with soap or alcohol-based gel.",
      "Avoid going out while you still have a fever.",
    ],
    references: [
      {
        title: "Influenza (Seasonal)",
        source: "World Health Organization (WHO)",
        url: "https://www.who.int/health-topics/influenza-seasonal",
      },
      {
        title: "Thailand influenza prevention guidance (Thai)",
        source: "Department of Disease Control, Thailand",
        url: "https://ddc.moph.go.th/brc/news.php?news=15080",
      },
    ],
  },
  {
    slug: "home-medicine-kit",
    title: "A sensible home medicine kit",
    excerpt:
      "A small home kit can help mild symptoms, but should match age, conditions, and medicines you already take.",
    category: "Medication use",
    paragraphs: [
      "Common items include pain/fever relievers, decongestants, sore-throat lozenges, and basic wound care. Store in a dry place away from sunlight and check expiry dates regularly.",
      "Keep a list of what you have at home and tell your doctor or pharmacist whenever you receive new prescriptions to avoid duplication or interactions.",
    ],
    highlights: [
      "Clearly separate adult and child products.",
      "Do not repackage tablets you cannot read or understand on the label.",
      "Keep a note of allergies and chronic conditions with the kit.",
    ],
    references: [
      {
        title: "Safe use of medicines at home (Thai FDA)",
        source: "Thai Food and Drug Administration",
        url: "https://www.fda.moph.go.th/",
      },
    ],
  },
  {
    slug: "hand-hygiene",
    title: "Hand hygiene to reduce infections",
    excerpt:
      "Soap and water remain the gold standard for removing germs in daily life.",
    category: "Prevention",
    paragraphs: [
      "Many germs spread via hands touching the face, mouth, nose, or food. Scrub all surfaces of the hands, fingers, and under nails for at least about 20 seconds.",
      "Alcohol gel (at least about 70%) helps when soap is unavailable, but wash with soap and water if hands are visibly dirty, bloody, or soiled.",
    ],
    highlights: [
      "Wash before eating, after using the toilet, and after touching shared surfaces.",
      "Dry hands with a clean towel or air dryer after washing.",
    ],
    references: [
      {
        title: "Hand hygiene",
        source: "World Health Organization (WHO)",
        url: "https://www.who.int/campaigns/world-hand-hygiene-day",
      },
      {
        title: "Hand hygiene guide (Thai)",
        source: "Department of Disease Control, Thailand",
        url: "https://ddc.moph.go.th/",
      },
    ],
  },
  {
    slug: "dehydration",
    title: "Warning signs of dehydration",
    excerpt:
      "Dehydration may follow fever, diarrhea, or hot weather. Spotting symptoms early helps you rehydrate in time.",
    category: "Nutrition",
    paragraphs: [
      "Water supports temperature control, nutrient transport, and waste removal. Early signs include thirst, dark urine, dry mouth, and fatigue.",
      "Children and older adults may show subtler signs—monitor closely. Seek urgent care for confusion, rapid breathing, or no urine for a prolonged period.",
    ],
    highlights: [
      "Drink water regularly, especially during exercise or heat.",
      "Limit excessive caffeine when you are losing a lot of fluid.",
    ],
    references: [
      {
        title: "Water: How much should you drink every day?",
        source: "Mayo Clinic",
        url: "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256",
      },
    ],
  },
  {
    slug: "sleep-basics",
    title: "Sleep enough for better health",
    excerpt:
      "Sleep quality links to immunity, mood, and memory. A simple bedtime routine helps.",
    category: "Lifestyle",
    paragraphs: [
      "Most adults need roughly 7–9 hours of sleep per night, but needs vary. A consistent sleep and wake time stabilises your body clock.",
      "Reduce bright screens before bed, limit caffeine in the late afternoon, and keep the bedroom dark, quiet, and comfortably cool.",
    ],
    highlights: [
      "Avoid using the bed mainly as a desk or TV spot.",
      "If you cannot fall asleep after ~20 minutes, get up briefly, relax, then return.",
    ],
    references: [
      {
        title: "Sleep tips: 6 steps to better sleep",
        source: "Mayo Clinic",
        url: "https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/sleep/art-20048379",
      },
    ],
  },
  {
    slug: "blood-pressure-diet",
    title: "Basic nutrition tips for blood pressure care",
    excerpt:
      "Lowering sodium and eating more vegetables are common foundations alongside regular monitoring.",
    category: "Chronic disease",
    paragraphs: [
      "Sodium from table salt and processed seasonings contributes to high blood pressure for many people. Reading nutrition labels and choosing lower-sodium foods helps.",
      "Diets rich in vegetables, fruit, whole grains, and lean protein align with DASH-style guidance that can support blood pressure control—adjust for other conditions you may have.",
    ],
    highlights: [
      "Limit pickled foods, ultra-processed snacks, and very salty treats.",
      "Measure blood pressure as advised and keep a simple log.",
    ],
    references: [
      {
        title: "DASH eating plan",
        source: "National Heart, Lung, and Blood Institute (NHLBI), NIH",
        url: "https://www.nhlbi.nih.gov/education/dash-eating-plan",
      },
      {
        title: "Hypertension information (Thai Ministry)",
        source: "Department of Medical Services, Thailand",
        url: "https://www.dms.go.th/",
      },
    ],
  },
  {
    slug: "antibiotic-awareness",
    title: "Why you should not take antibiotics without need",
    excerpt:
      "Antibiotics treat bacterial infections. Misuse drives antimicrobial resistance.",
    category: "Medication use",
    paragraphs: [
      "Influenza and the common cold are usually viral; antibiotics do not kill viruses. Unnecessary antibiotics increase allergy risk, diarrhoea from resistant organisms, and resistance in the community.",
      "If an antibiotic is prescribed, complete the full course even when you feel better, unless your clinician tells you to stop—this reduces surviving resistant bacteria.",
    ],
    highlights: [
      "Do not self-start leftover antibiotics without medical advice.",
      "Do not pressure clinicians for antibiotics when a viral illness is likely.",
    ],
    references: [
      {
        title: "Antimicrobial resistance",
        source: "World Health Organization (WHO)",
        url: "https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance",
      },
      {
        title: "Rational antibiotic use (Thai)",
        source: "Department of Disease Control, Thailand",
        url: "https://ddc.moph.go.th/",
      },
    ],
  },
]
