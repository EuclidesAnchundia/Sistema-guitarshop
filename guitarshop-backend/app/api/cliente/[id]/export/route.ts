import { NextResponse } from "next/server";
import { jsonCors, optionsCors, applyCorsHeaders } from "../../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../../lib/auth";
import { exportSingleClientePdf } from "../../../../../lib/services/clienteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsCors();
}

export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Solo administradores pueden exportar clientes" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const idString = parts[parts.length - 2];
    const id = Number(idString);
    if (!id || Number.isNaN(id)) {
      return jsonCors({ error: "ID inválido" }, { status: 400 });
    }

    const { buffer, filename } = await exportSingleClientePdf(id);

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
      return jsonCors({ error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("Error GET /cliente/:id/export:", error);
    return jsonCors({ error: "Error al exportar cliente" }, { status: 500 });
  }
}
