import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";

export async function OPTIONS() {
  return optionsCors();
}

export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });

  try {
    const body = await req.json();
    const kind = String(body.kind ?? "").toLowerCase();

    const codeService = await import("../../../../lib/services/codeService");

    if (kind === "factura" || kind === "venta") {
      const date = body.date ? new Date(String(body.date)) : new Date();
      const code = await codeService.generateFacturaNumber(prisma, date);
      return jsonCors({ code }, { status: 200 });
    }

    if (kind === "producto") {
      const count = Number(body.count ?? 1)
      const prefixes = Array.isArray(body.prefixes) ? body.prefixes : undefined
      if (count > 1) {
        // generar lote
        const codes = await codeService.generateProductCodesBatch(prisma, count, prefixes)
        return jsonCors({ codes }, { status: 200 })
      }

      const prefix = body.prefix ? String(body.prefix) : "PRD";
      const code = await codeService.generateProductCode(prisma, prefix);
      return jsonCors({ code }, { status: 200 });
    }

    return jsonCors({ error: "Kind inválido" }, { status: 400 });
  } catch (error) {
    console.error("Error POST /codigos/next:", error);
    return jsonCors({ error: "Error generando código" }, { status: 500 });
  }
}
