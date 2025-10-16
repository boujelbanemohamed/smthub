import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { NextURL } from "next/dist/server/web/next-url"

// Helper to parse session and redirect
const parseSessionAndRedirect = (session: any, pathname: string, requestUrl: NextURL) => {
  try {
    return JSON.parse(session.value)
  } catch {
    const loginUrl = new URL("/login", requestUrl)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get("user-session")
  
  const protectedRoutes = ["/profile", "/admin"]
  const adminRoutes = ["/admin"]
  
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdminRoute && session) {
    const userData = parseSessionAndRedirect(session, pathname, request.nextUrl)
    if (userData.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  if (pathname === "/login" && session) {
    try {
      JSON.parse(session.value)
      return NextResponse.redirect(new URL("/", request.url))
    } catch {}
  }

  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  )
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
