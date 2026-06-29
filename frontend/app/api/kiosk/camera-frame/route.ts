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

export async function GET() {
  try {
    const res = await fetch(
      `${getBackendBase()}/api/kiosk/display/camera-frame?t=${Date.now()}`,
      { cache: "no-store" }
    )

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
