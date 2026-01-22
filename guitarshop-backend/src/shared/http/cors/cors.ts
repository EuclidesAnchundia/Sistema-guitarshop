import { NextResponse } from "next/server";

const CONFIG_CORS = process.env.CORS_ORIGIN ?? "*";

function isAllowedOrigin(origin: string | null, allowed: string) {
  if (!origin) return false;
  if (allowed.trim() === "*") return true;
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin);
}

export function applyCorsHeaders(res: NextResponse, requestOrigin?: string | null) {
  const originToSet = requestOrigin && isAllowedOrigin(requestOrigin, CONFIG_CORS)
    ? requestOrigin
    : CONFIG_CORS;

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
