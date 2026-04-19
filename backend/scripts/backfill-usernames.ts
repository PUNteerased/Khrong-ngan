/**
 * รันครั้งเดียวเมื่ออัปเกรดจาก schema เก่าที่ username ยังว่าง:
 * ตั้ง username จากเบอร์เดิม หรือ u_<id> ถ้าไม่มีเบอร์
 */
import "../src/load-env.js"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { OR: [{ username: null }, { username: "" }] },
  })
  for (const u of users) {
    const fromPhone = u.phone?.replace(/\D/g, "") ?? ""
    const username =
      fromPhone.length === 10
        ? fromPhone
        : `u_${u.id.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`
    await prisma.user.update({
      where: { id: u.id },
      data: { username },
    })
    console.log(`backfill ${u.id} -> ${username}`)
  }
  console.log("backfill usernames OK")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
