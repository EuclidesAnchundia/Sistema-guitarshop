import { NextResponse } from "next/server";
import { optionsCors, applyCorsHeaders } from "../../../../../lib/cors";
import { verifyToken } from "../../../../../lib/auth";
import { exportSingleCreditPdf } from "../../../../../lib/services/creditoService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsCors();
}

export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return applyCorsHeaders(NextResponse.json({ error: auth.message ?? "Token inválido" }, { status: 401 }));
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const idString = parts[parts.length - 2];
    const id = Number(idString);
    if (!id || Number.isNaN(id)) {
      return applyCorsHeaders(NextResponse.json({ error: "ID inválido" }, { status: 400 }));
    }

    const { buffer, filename } = await exportSingleCreditPdf(id);

    const res = new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

    applyCorsHeaders(res);
    return res;
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return applyCorsHeaders(NextResponse.json({ error: "Crédito no encontrado" }, { status: 404 }));
    }
    console.error("Error GET /credits/:id/export:", error);
    return applyCorsHeaders(NextResponse.json({ error: "Error al exportar crédito" }, { status: 500 }));
  }
}
