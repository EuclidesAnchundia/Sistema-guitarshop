import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? "*";

export function applyCorsHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
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
  if (ALLOWED_ORIGIN !== "*") {
    res.headers.set("Access-Control-Allow-Credentials", "true");
  } else {
    res.headers.delete("Access-Control-Allow-Credentials");
  }
  return res;
}

export function jsonCors<T>(body: T, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  return applyCorsHeaders(res);
}


export function optionsCors() {
  // 200 evita confusiones en algunos clientes; el preflight no debe validar token.
  // Max-Age reduce la cantidad de preflights repetidos en dev.
  const res = new NextResponse(null, { status: 200 });
  res.headers.set("Access-Control-Max-Age", "86400");
  return applyCorsHeaders(res);
}
