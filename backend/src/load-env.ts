/**
 * ต้อง import เป็นอันดับแรกจาก index.ts เพื่อให้ process.env พร้อมก่อนโมดูลอื่น
 */
import path from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, "..")
const envPath = path.join(backendRoot, ".env")

const result = dotenv.config({ path: envPath })

if (result.error) {
  if (!existsSync(envPath)) {
    console.warn(
      `[LaneYa API] ไม่พบไฟล์ .env ที่ ${envPath} — คัดลอกจาก .env.example`
    )
  } else {
    console.warn(`[LaneYa API] โหลด .env ไม่สำเร็จ:`, result.error.message)
  }
} else {
  console.log(`[LaneYa API] โหลดค่าจาก ${envPath}`)
}
