import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/@vite/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // REMOVIDO: DEMO_MODE por questões de segurança
  // Todas as rotas agora requerem autenticação adequada

  const token = request.cookies.get('grifo_token')?.value
  
  const protectedRoutes = ['/dashboard', '/users', '/properties', '/inspections', '/reports']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  const authRoutes = ['/login']
  const isAuthRoute = authRoutes.includes(pathname)
  
  // Public routes that don't require authentication
  const publicRoutes = ['/contestar']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Allow access to public routes without authentication
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  if (pathname === '/') {
    return NextResponse.redirect(new URL(token ? '/dashboard' : '/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}