import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Dashboard auth is disabled. Keep the middleware in place so we can add a
  // different gate later without changing the routing surface.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
