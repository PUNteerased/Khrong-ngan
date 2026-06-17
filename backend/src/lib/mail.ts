import { Resend } from "resend"

export type SendMailResult = { sent: boolean; skippedReason?: string }

export async function sendVerificationEmail(to: string, code: string): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey || !from) {
    return { sent: false, skippedReason: "RESEND_API_KEY or RESEND_FROM_EMAIL not set" }
  }

  const resend = new Resend(apiKey)

  const subject = "รหัสยืนยัน LaneYa (6 หลัก)"
  const text = `รหัสยืนยันของคุณคือ ${code}\nรหัสหมดอายุใน 5 นาที\n\nถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้`

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    text,
    html: `<p>รหัสยืนยันของคุณคือ <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>รหัสหมดอายุใน 5 นาที</p><p style="color:#666;font-size:12px">ถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้</p>`,
  })
  if (error) {
    throw new Error(error.message || "Resend send failed")
  }

  return { sent: true }
}
