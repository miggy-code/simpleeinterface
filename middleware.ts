/**
 * Basic-auth middleware. If DASHBOARD_PASSWORD is set, gate every request
 * behind HTTP Basic auth. Set DASHBOARD_PASSWORD="" or unset to disable.
 */
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  // No password configured → no gate.
  if (!password) return NextResponse.next();

  const username = process.env.DASHBOARD_USERNAME || "throttl";
  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString();
      const [u, p] = decoded.split(":");
      if (u === username && p === password) return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Throttl CRM"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
