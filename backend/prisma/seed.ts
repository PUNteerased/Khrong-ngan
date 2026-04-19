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
    },
    {
      name: "ไอบูโพรเฟน 400mg",
      description: "ลดการอักเสบ บรรเทาปวด",
      slotId: "A2",
      quantity: 5,
      category: "ยาแก้ปวด",
    },
    {
      name: "ยาแก้แพ้ Loratadine",
      description: "บรรเทาอาการแพ้ น้ำมูกไหล",
      slotId: "B1",
      quantity: 2,
      category: "ยาแก้แพ้",
    },
    {
      name: "ยาธาตุน้ำขาว",
      description: "บรรเทาอาการท้องเสีย",
      slotId: "B2",
      quantity: 0,
      category: "ยาระบบทางเดินอาหาร",
    },
    {
      name: "ยาอมแก้เจ็บคอ",
      description: "บรรเทาอาการเจ็บคอ",
      slotId: "C1",
      quantity: 10,
      category: "ยาแก้ไอ",
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
