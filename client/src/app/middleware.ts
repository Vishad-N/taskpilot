import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isTokenExpired = (tokenValue?: string) => {
  if (!tokenValue) return true;

  try {
    const [, payload] = tokenValue.split(".");
    if (!payload) return true;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: number };

    if (!decoded.exp) return false;

    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const hasValidToken = token ? !isTokenExpired(token) : false;
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    if (hasValidToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const response = NextResponse.next();
    if (token && !hasValidToken) {
      response.cookies.set("token", "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/"
      });
    }
    return response;
  }

  if (!hasValidToken) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) {
      response.cookies.set("token", "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/"
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/dashboards/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/activity/:path*",
    "/notifications/:path*",
    "/users/:path*",
    "/superadmin/:path*"
  ]
};
