import axios from "axios"

export type DifyChatResponse = {
  answer: string
  conversation_id: string
  message_id?: string
}

function pickDifyErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : "เชื่อมต่อ AI ไม่สำเร็จ"
  }
  const raw: unknown = err.response?.data
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  if (raw && typeof raw === "object") {
    const o = raw as { message?: string; error?: string }
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.trim()
    }
    if (typeof o.error === "string" && o.error.trim()) {
      return o.error.trim()
    }
  }
  if (err.response?.status === 401 || err.response?.status === 403) {
    return "คีย์ Dify ไม่ถูกต้องหรือหมดอายุ — ตรวจสอบ DIFY_API_KEY ใน backend/.env"
  }
  if (err.code === "ECONNABORTED") {
    return "เชื่อมต่อ Dify หมดเวลา — ลองใหม่อีกครั้ง"
  }
  return err.message || "เชื่อมต่อ Dify ไม่สำเร็จ"
}

/**
 * เรียก Dify Chat API (blocking)
 * @see https://docs.dify.ai/guides/application-publishing/developing-with-apis
 */
export async function sendDifyChatMessage(params: {
  query: string
  user: string
  conversationId?: string | null
  inputs: Record<string, string>
}): Promise<DifyChatResponse> {
  const apiKey = process.env.DIFY_API_KEY?.trim()
  const base = (process.env.DIFY_API_BASE || "https://api.dify.ai/v1").replace(
    /\/$/,
    ""
  )

  if (!apiKey) {
    throw new Error(
      "DIFY_API_KEY ไม่ได้ตั้งค่า — ใส่ใน backend/.env แล้วรีสตาร์ทเซิร์ฟเวอร์"
    )
  }

  const url = `${base}/chat-messages`

  const body = {
    inputs: params.inputs,
    query: params.query,
    response_mode: "blocking" as const,
    conversation_id: params.conversationId || undefined,
    user: params.user,
  }

  try {
    const { data } = await axios.post<
      DifyChatResponse & { data?: DifyChatResponse }
    >(url, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120_000,
    })

    // บางเวอร์ชันอาจห่อผลลัพธ์
    const payload = (data as { data?: DifyChatResponse }).data ?? data

    return {
      answer: payload.answer || "",
      conversation_id:
        payload.conversation_id || params.conversationId || "",
      message_id: payload.message_id,
    }
  } catch (err) {
    throw new Error(pickDifyErrorMessage(err))
  }
}
