import { NextResponse } from "next/server"

const PRODUCTION_API_URL = "https://khrong-ngan.onrender.com"

function getBackendBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  if (configured) return configured
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return PRODUCTION_API_URL
  }
  return "http://localhost:4000"
}

// #region agent log
function agentLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>
) {
  fetch("http://127.0.0.1:7260/ingest/26c5933f-6382-407d-ae45-cd1aa28cfea1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "36e0e6",
    },
    body: JSON.stringify({
      sessionId: "36e0e6",
      hypothesisId,
      location: "app/api/kiosk/camera-frame/route.ts",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

export async function GET() {
  try {
    const res = await fetch(
      `${getBackendBase()}/api/kiosk/display/camera-frame?t=${Date.now()}`,
      { cache: "no-store" }
    )

    // #region agent log
    agentLog("H3", "proxy camera-frame upstream status", {
      status: res.status,
      backend: getBackendBase(),
    })
    // #endregion

    if (res.status === 204 || res.status === 404) {
      return new NextResponse(null, { status: 204 })
    }

    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }

    const body = await res.arrayBuffer()
    if (body.byteLength < 100) {
      return new NextResponse(null, { status: 204 })
    }

    // #region agent log
    agentLog("H3", "proxy camera-frame returning jpeg", {
      bytes: body.byteLength,
    })
    // #endregion

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
