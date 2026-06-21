import createMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import { routing } from "./i18n/routing"

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  if (pathname.startsWith("/kiosk")) {
    const token = process.env.KIOSK_DISPLAY_TOKEN?.trim()
    if (token) {
      const fromQuery = searchParams.get("token")
      const fromCookie = request.cookies.get("kiosk_token")?.value
      const provided = fromQuery || fromCookie
      if (provided !== token) {
        return new NextResponse("Unauthorized kiosk display", { status: 401 })
      }
      if (fromQuery === token) {
        const url = request.nextUrl.clone()
        url.searchParams.delete("token")
        const res = NextResponse.redirect(url)
        res.cookies.set("kiosk_token", token, {
          httpOnly: true,
          sameSite: "lax",
          path: "/kiosk",
          maxAge: 60 * 60 * 24 * 365,
        })
        return res
      }
    }
    return NextResponse.next()
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
