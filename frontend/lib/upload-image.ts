import { getSupabaseClient, SUPABASE_BUCKET } from "./supabase"

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function fileExtension(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : ""
  if (fromName) return fromName.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin"
  const fromMime = file.type.split("/")[1] || ""
  return (fromMime.replace(/[^a-z0-9]/g, "") || "bin").slice(0, 8)
}

export type UploadResult = {
  url: string
  path: string
}

/**
 * อัปโหลดรูปภาพไปยัง Supabase Storage (public bucket)
 *
 * @param file รูปภาพจาก <input type="file"> (ควร validate type/size ก่อนหน้านี้)
 * @param folder โฟลเดอร์ย่อยใน bucket เช่น "drugs" | "avatars" | "chat"
 * @returns public URL ที่ใช้แสดงรูปได้ทันที
 */
export async function uploadImage(
  file: File,
  folder: string
): Promise<UploadResult> {
  const supabase = getSupabaseClient()
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "")
  const path = `${safeFolder ? safeFolder + "/" : ""}${randomId()}.${fileExtension(file)}`

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    })

  if (error) {
    const msg =
      error.message ||
      "อัปโหลดไปยัง Supabase Storage ไม่สำเร็จ — ตรวจสอบ bucket/policy"
    throw new Error(msg)
  }

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    throw new Error("ไม่สามารถดึง public URL จาก Supabase ได้")
  }

  return { url: data.publicUrl, path }
}
