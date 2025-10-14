import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get session cookie
  const session = request.cookies.get("user-session")
  
  // Protected routes that require authentication
  const protectedRoutes = ["/profile", "/admin"]
  
  // Admin-only routes
  const adminRoutes = ["/admin"]
  
  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  
  // If accessing a protected route without session, redirect to login
  if (isProtectedRoute && !session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // If user has session, check role for admin routes
  if (isAdminRoute && session) {
    try {
      const userData = JSON.parse(session.value)
      if (userData.role !== "admin") {
        // Non-admin trying to access admin route, redirect to home
        return NextResponse.redirect(new URL("/", request.url))
      }
    } catch {
      // Invalid session, redirect to login
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // If user is logged in and trying to access login page, redirect to home
  if (pathname === "/login" && session) {
    try {
      JSON.parse(session.value) // Validate session format
      return NextResponse.redirect(new URL("/", request.url))
    } catch {
      // Invalid session, allow access to login
    }
  }
  
  // Add security headers
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  
  // CSP header for additional security
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
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
