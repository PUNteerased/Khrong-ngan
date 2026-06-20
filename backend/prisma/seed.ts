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
      name: "พาราเซตามอล 500mg",
      description: "บรรเทาอาการปวด ลดไข้",
      slotId: "A1",
      quantity: 8,
      category: "ยาแก้ปวด",
      dosageNotes: "ผู้ใหญ่: 1-2 เม็ด ทุก 4-6 ชั่วโมง เมื่อมีอาการ",
      warnings: "ห้ามเกิน 4,000 มก./วัน | ห้ามใช้ในผู้ที่มีโรคตับรุนแรง",
      ingredientsText: "paracetamol,acetaminophen,พาราเซตามอล",
    },
    {
      name: "ไอบูโพรเฟน 400mg",
      description: "ลดการอักเสบ บรรเทาปวด",
      slotId: "A2",
      quantity: 5,
      category: "ยาแก้ปวด",
      dosageNotes: "ผู้ใหญ่: 1 เม็ด ทุก 6-8 ชั่วโมง ทานหลังอาหารทันที",
      warnings:
        "ระวังในผู้ป่วยโรคกระเพาะ / NSAID allergy | ห้ามใช้ในไตรมาสที่ 3 ของการตั้งครรภ์",
      ingredientsText: "ibuprofen,nsaid,ไอบูโพรเฟน",
    },
    {
      name: "Loratadine 10mg",
      description: "บรรเทาอาการแพ้ น้ำมูกไหล คัดจมูก",
      slotId: "A3",
      quantity: 6,
      category: "ยาแก้แพ้",
      dosageNotes: "ผู้ใหญ่: 1 เม็ด วันละ 1 ครั้ง",
      warnings: "ระวังในผู้ป่วยโรคตับ",
      ingredientsText: "loratadine,ลอราทาดีน",
    },
    {
      name: "ยาแก้ไอ Dextromethorphan",
      description: "บรรเทาอาการไอแห้ง",
      slotId: "A4",
      quantity: 4,
      category: "ยาแก้ไอ",
      dosageNotes: "ผู้ใหญ่: ตามฉลาก ทุก 6-8 ชั่วโมง",
      warnings: "ห้ามใช้ในเด็กอายุต่ำกว่า 6 ปี | ระวังการใช้ร่วมกับยากลุ่ม MAOI",
      ingredientsText: "dextromethorphan,dxm",
    },
    {
      name: "ยาอมแก้เจ็บคอ",
      description: "บรรเทาอาการเจ็บคอ คันคอ",
      slotId: "A5",
      quantity: 10,
      category: "ยาแก้ไอ",
      dosageNotes: "อมช้า ๆ ทุก 2-3 ชั่วโมง",
      warnings: "ระวังในเด็กอายุต่ำกว่า 6 ปี",
      ingredientsText: "benzocaine,menthol,eucalyptus",
    },
    {
      name: "ยาธาตุน้ำขาว",
      description: "บรรเทาอาการท้องเสีย",
      slotId: "B1",
      quantity: 5,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "ดูตามฉลาก หลังถ่ายทุกครั้ง",
      warnings: "ห้ามใช้ต่อเนื่องเกิน 2 วัน หากอาการไม่ดีขึ้นควรพบแพทย์",
      ingredientsText: "bismuth,kaolin,pectin,attapulgite",
    },
    {
      name: "ORS เกลือแร่",
      description: "ทดแทนน้ำและเกลือแร่ หลังท้องเสีย อาเจียน",
      slotId: "B2",
      quantity: 8,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "ละลายน้ำตามฉลาก ดื่มทีละน้อยบ่อย ๆ",
      warnings: "ผู้ป่วยไตวาย ควรปรึกษาแพทย์ก่อนใช้",
      ingredientsText: "ors,electrolyte,sodium,potassium,glucose",
    },
    {
      name: "ยาลดกรด แก้ท้องอืด",
      description: "บรรเทาอาการท้องอืด แสบร้อนกลางอก",
      slotId: "B3",
      quantity: 6,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "1-2 เม็ด หลังอาหารและก่อนนอน",
      warnings: "ห้ามใช้ต่อเนื่องเกิน 2 สัปดาห์ หากอาการไม่ดีขึ้น",
      ingredientsText: "aluminium,magnesium,hydroxide,antacid,แมกนีเซียม",
    },
    {
      name: "บalm นวด (ตราเสือ)",
      description: "บรรเทาอาการปวดเมื่อยกล้ามเนื้อ",
      slotId: "B4",
      quantity: 4,
      category: "ยาทาภายนอก",
      dosageNotes: "ทาบาง ๆ บริเวณที่ปวด 2-3 ครั้ง/วัน",
      warnings: "ห้ามทาบาดแผลเปิด | ล้างมือหลังใช้ | หลีกเลี่ยงบริเวณตา",
      ingredientsText: "menthol,camphor,methyl salicylate",
    },
    {
      name: "วิตามินซี 1000mg",
      description: "เสริมวิตามินซี ช่วยภูมิคุ้มกัน",
      slotId: "B5",
      quantity: 7,
      category: "วิตามิน",
      dosageNotes: "1 เม็ด วันละ 1 ครั้ง หลังอาหาร",
      warnings: "ผู้ป่วยไตหิน ควรใช้ด้วยความระมัดระวัง",
      ingredientsText: "ascorbic acid,vitamin c,วิตามินซี",
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
