import { NextResponse } from "next/server";

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

export function applyCorsHeaders(res: NextResponse, requestOrigin?: string | null) {
  let originToSet: string;
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    originToSet = requestOrigin;
  } else if (ALLOWED_LIST.length === 1 && ALLOWED_LIST[0] !== "*") {
    originToSet = ALLOWED_LIST[0];
  } else if (ALLOWED_LIST.length === 1 && ALLOWED_LIST[0] === "*") {
    originToSet = "*";
  } else {
    // Multiple allowed origins configured but request origin not allowed —
    // don't return a comma-separated list (invalid). Use wildcard to fail safely.
    originToSet = "*";
  }

  res.headers.set("Access-Control-Allow-Origin", originToSet);
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Para que el frontend pueda leer el nombre sugerido.
  res.headers.set("Access-Control-Expose-Headers", "Content-Disposition");

  // Si Allow-Origin es '*', no se puede usar credentials.
  if (originToSet !== "*") {
    res.headers.set("Access-Control-Allow-Credentials", "true");
  } else {
    res.headers.delete("Access-Control-Allow-Credentials");
  }
  return res;
}

export function jsonCors<T>(body: T, init?: ResponseInit, request?: Request) {
  const res = NextResponse.json(body, init);
  const origin = request ? request.headers.get("origin") : null;
  return applyCorsHeaders(res, origin);
}

export function optionsCors(request?: Request) {
  // 200 evita confusiones en algunos clientes; el preflight no debe validar token.
  // Max-Age reduce la cantidad de preflights repetidos en dev.
  const res = new NextResponse(null, { status: 200 });
  res.headers.set("Access-Control-Max-Age", "86400");
  const origin = request ? request.headers.get("origin") : null;
  return applyCorsHeaders(res, origin);
}
