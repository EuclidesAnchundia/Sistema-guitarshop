import { NextResponse, type NextRequest } from "next/server";

const CONFIG_CORS = process.env.CORS_ORIGIN ?? "*";

function normalizeOrigin(o: string) {
  return o.trim().replace(/\/$/, "").toLowerCase();
}

const ALLOWED_LIST = CONFIG_CORS === "*"
  ? ["*"]
  : CONFIG_CORS.split(",").map((s) => normalizeOrigin(s)).filter(Boolean);

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (ALLOWED_LIST.length === 1 && ALLOWED_LIST[0] === "*") return true;
  return ALLOWED_LIST.includes(normalizeOrigin(origin));
}

function pickOrigin(requestOrigin: string | null) {
  if (requestOrigin && isAllowedOrigin(requestOrigin)) return requestOrigin;
  if (ALLOWED_LIST.length === 1) return ALLOWED_LIST[0];
  return "*";
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const originToSet = pickOrigin(origin);

  const res = NextResponse.next();

  res.headers.set("Access-Control-Allow-Origin", originToSet);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Expose-Headers", "Content-Disposition");
  res.headers.set("Access-Control-Max-Age", "86400");
  if (originToSet !== "*") {
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // If this is an OPTIONS preflight, return immediately with 200
  if (req.method === "OPTIONS") {
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
