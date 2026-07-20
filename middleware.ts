import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get(SESSION_COOKIE_NAME)

  const protectedRoutes = ["/profile", "/admin", "/my-activity"]
  const adminRoutes = ["/admin"]

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))

  const userData = session?.value ? await verifySession(session.value) : null

  if (isProtectedRoute && !userData) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    if (session && !userData) {
      redirectResponse.cookies.delete(SESSION_COOKIE_NAME)
    }
    return redirectResponse
  }

  if (isAdminRoute && userData && userData.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (pathname === "/login" && userData) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  // Autoriser 'unsafe-eval' uniquement en développement pour React Refresh/webpack
  const isDev = process.env.NODE_ENV !== "production"
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Autorise l'affichage d'applications en cadre intégré (page /embed).
    "frame-src 'self' https:",
    "child-src 'self' https:"
  ].join("; ") + ";"
  response.headers.set("Content-Security-Policy", csp)
  
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
