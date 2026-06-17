import "../src/load-env.js"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { normalizeUsername } from "../src/lib/username.js"

const prisma = new PrismaClient()

const SALT_ROUNDS = 10

/** บัญชีผู้ดูแลสำหรับ dev — ตั้งค่าใน .env ได้ (อย่าใช้รหัสเริ่มต้นใน production) */
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
      name: "ยาแก้แพ้ Loratadine",
      description: "บรรเทาอาการแพ้ น้ำมูกไหล",
      slotId: "B1",
      quantity: 2,
      category: "ยาแก้แพ้",
      dosageNotes: "ผู้ใหญ่: 1 เม็ด วันละ 1 ครั้ง",
      warnings: "ระวังในผู้ป่วยโรคตับ",
      ingredientsText: "loratadine,ลอราทาดีน",
    },
    {
      name: "ยาธาตุน้ำขาว",
      description: "บรรเทาอาการท้องเสีย",
      slotId: "B2",
      quantity: 0,
      category: "ยาระบบทางเดินอาหาร",
      dosageNotes: "ดูตามฉลาก",
      warnings: "ห้ามใช้ต่อเนื่องเกิน 2 วัน หากอาการไม่ดีขึ้นควรพบแพทย์",
      ingredientsText: "bismuth,kaolin,pectin",
    },
    {
      name: "ยาอมแก้เจ็บคอ",
      description: "บรรเทาอาการเจ็บคอ",
      slotId: "C1",
      quantity: 10,
      category: "ยาแก้ไอ",
      dosageNotes: "อมช้า ๆ ทุก 2-3 ชั่วโมง",
      warnings: "ระวังในเด็กอายุต่ำกว่า 6 ปี",
      ingredientsText: "benzocaine,menthol,eucalyptus",
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

  console.log("Seed drugs OK")

  await seedAdminUser()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
