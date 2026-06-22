import "../src/load-env.js"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { normalizeUsername } from "../src/lib/username.js"

const prisma = new PrismaClient()

const SALT_ROUNDS = 10

async function seedAdminUser() {
  const rawUser = process.env.ADMIN_SEED_USERNAME ?? "admin"
  const password = process.env.ADMIN_SEED_PASSWORD ?? "laneYa_admin_dev"
  const username = normalizeUsername(rawUser)
  if (!username) {
    console.warn("ADMIN_SEED_USERNAME ว่าง — ข้ามการสร้างผู้ดูแล")
    return
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      isAdmin: true,
      fullName: "ผู้ดูแลระบบ (seed)",
    },
    create: {
      username,
      passwordHash,
      isAdmin: true,
      fullName: "ผู้ดูแลระบบ (seed)",
    },
  })
  console.log(`Seed admin OK — username: ${username}`)
}

async function main() {
  const drugs = [
    {
      name: "ยาพาราเซตามอล",
      description: "บรรเทาอาการปวดและลดไข้ (ชื่อสามัญ: Paracetamol | ชื่อทั่วไป: พารา)",
      slotId: "A1",
      quantity: 8,
      category: "ยาแก้ปวด",
      dosageNotes: "ผู้ใหญ่: 1-2 เม็ด 500 มก. ทุก 4-6 ชั่วโมง เมื่อมีอาการ",
      warnings: "ห้ามเกิน 4,000 มก./วัน | ห้ามใช้ในผู้ที่มีโรคตับรุนแรง",
      ingredientsText: "paracetamol,acetaminophen,พาราเซตามอล,พารา",
    },
    {
      name: "ยาไซเมทิโคน",
      description: "บรรเทาอาการท้องอืด ท้องเฟ้อ ขับลม (Simethicone | แอร์-เอ็กซ์)",
      slotId: "A2",
      quantity: 6,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "ผู้ใหญ่: 1-2 เม็ด/แคปซูล หลังอาหารและก่อนนอน ตามฉลาก",
      warnings: "หากอาการไม่ดีขึ้นภายใน 2 สัปดาห์ ควรพบแพทย์",
      ingredientsText: "simethicone,ไซเมทิโคน,air-x,แอร์-เอ็กซ์",
    },
    {
      name: "ยาคลอเฟนิรามีน",
      description: "ยาแก้แพ้ ลดน้ำมูก บรรเทาอาการคัน (Chlorpheniramine | แก้แพ้ แก้คัน)",
      slotId: "A3",
      quantity: 6,
      category: "ยาแก้แพ้",
      dosageNotes: "ผู้ใหญ่: 4 มก. ทุก 4-6 ชั่วโมง ไม่เกิน 24 มก./วัน",
      warnings: "อาจง่วงซึม — ห้ามขับรถ | ระวังในผู้สูงอายุ",
      ingredientsText: "chlorpheniramine,cpm,คลอร์เฟนิรามีน,antihistamine,ยาแก้แพ้",
    },
    {
      name: "ยาไดเมนไฮดริเนต",
      description: "บรรเทาอาการเมารถ เมาเรือ คลื่นไส้อาเจียน (Dimenhydrinate | เมารถ)",
      slotId: "A4",
      quantity: 5,
      category: "ยาแก้เมารถ",
      dosageNotes: "ผู้ใหญ่: 50 มก. ทุก 4-6 ชั่วโมง ก่อนเดินทาง ตามฉลาก",
      warnings: "อาจง่วงซึม | ห้ามใช้ใน glaucoma ตีบ | ระวังในผู้สูงอายุ",
      ingredientsText: "dimenhydrinate,ไดเมนไฮดริเนต,เมารถ,dramamine",
    },
    {
      name: "ผงถ่านกัมมันต์ชนิดแคปซูล",
      description: "ดูดซับสารพิษ รักษาอาการท้องเสีย (Activated Charcoal | ผงถ่าน)",
      slotId: "A5",
      quantity: 5,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "ผู้ใหญ่: ตามฉลาก หลังถ่ายทุกครั้งหรือตามแพทย์",
      warnings: "ห้ามใช้กับอาการท้องเสียมีเลือด/ไข้สูง | ห้ามใช้ต่อเนื่องเกิน 2 วัน",
      ingredientsText: "activated charcoal,charcoal,ถ่านกัมมันต์,ผงถ่าน",
    },
    {
      name: "ยาบรรเทาอาการไอขับเสมหะ",
      description: "บรรเทาอาการไอ (Cough syrup / Antitussives | แก้ไอ)",
      slotId: "B1",
      quantity: 4,
      category: "ยาแก้ไอ",
      dosageNotes: "ผู้ใหญ่: ตามฉลาก ทุก 6-8 ชั่วโมง",
      warnings: "ห้ามใช้ในเด็กอายุต่ำกว่า 6 ปี | ระวังการใช้ร่วมกับ MAOI",
      ingredientsText: "dextromethorphan,guaifenesin,cough,ยาแก้ไอ,dxm",
    },
    {
      name: "ยาลดน้ำมูกและบรรเทาอาการคัดจมูก",
      description: "ลดน้ำมูก คัดจมูก (Nasal decongestants | ลดน้ำมูก)",
      slotId: "B2",
      quantity: 6,
      category: "ยาแก้หวัด",
      dosageNotes: "ผู้ใหญ่: ตามฉลาก ไม่เกิน 7 วันต่อเนื่อง",
      warnings: "ห้ามใช้ต่อเนื่องเกิน 7 วัน | ระวังความดันโลหิตสูง",
      ingredientsText: "pseudoephedrine,phenylephrine,decongestant,ลดน้ำมูก,คัดจมูก",
    },
    {
      name: "สารสกัดฟ้าทะลายโจร",
      description: "บรรเทาอาการหวัด เจ็บคอ (Andrographis paniculata | ฟ้าทะลายโจร)",
      slotId: "B3",
      quantity: 5,
      category: "ยาสมุนไพร",
      dosageNotes: "ผู้ใหญ่: ตามฉลาก วันละ 2-3 ครั้ง",
      warnings: "ระวังในผู้ตั้งครรภ์ | อาจท้องเสียถ้าใช้เกินขนาด",
      ingredientsText: "andrographis,ฟ้าทะลายโจร,paniculata",
    },
    {
      name: "ผงขมิ้นชันแคปซูล",
      description: "บรรเทาอาการแน่นจุกเสียด ขับลม (Curcuma longa | ขมิ้นชัน)",
      slotId: "B4",
      quantity: 5,
      category: "ยาสมุนไพร",
      dosageNotes: "ผู้ใหญ่: 1-2 แคปซูล หลังอาหาร วันละ 2-3 ครั้ง",
      warnings: "ระวังในผู้มีนิ่วในถุงน้ำดด | ระวังร่วมกับยาต้านการแข็งตัวของเลือด",
      ingredientsText: "curcuma,turmeric,ขมิ้นชัน,curcumin",
    },
    {
      name: "กรดแอสคอร์บิก (วิตามินซี)",
      description: "เสริมภูมิคุ้มกัน (Ascorbic Acid / Vitamin C | วิตามินซี)",
      slotId: "B5",
      quantity: 7,
      category: "วิตามิน",
      dosageNotes: "ผู้ใหญ่: 1 เม็ด วันละ 1 ครั้ง หลังอาหาร",
      warnings: "ผู้ป่วยไตหิน ควรใช้ด้วยความระมัดระวัง",
      ingredientsText: "ascorbic acid,vitamin c,วิตามินซี,กรดแอสคอร์บิก",
    },
  ]

  for (const d of drugs) {
    await prisma.drug.upsert({
      where: { slotId: d.slotId },
      update: {
        name: d.name,
        description: d.description,
        quantity: d.quantity,
        category: d.category,
        dosageNotes: d.dosageNotes,
        warnings: d.warnings,
        ingredientsText: d.ingredientsText,
      },
      create: d,
    })
  }

  console.log("Seed drugs OK (10 slots A1-A5, B1-B5)")

  await seedAdminUser()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
