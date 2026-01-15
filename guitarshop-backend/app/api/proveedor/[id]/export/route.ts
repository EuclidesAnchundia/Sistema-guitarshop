import { NextResponse } from "next/server";
import { jsonCors, optionsCors, applyCorsHeaders } from "../../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../../lib/auth";
import { exportSingleProveedorPdf } from "../../../../../lib/services/proveedorService";

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

  if (!hasAdminRole(auth)) {
    return applyCorsHeaders(NextResponse.json({ error: "Solo administradores pueden exportar proveedores" }, { status: 403 }));
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const idString = parts[parts.length - 2];
    const id = Number(idString);
    if (!id || Number.isNaN(id)) {
      return applyCorsHeaders(NextResponse.json({ error: "ID inválido" }, { status: 400 }));
    }

    const { buffer, filename } = await exportSingleProveedorPdf(id);

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
      return applyCorsHeaders(NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 }));
    }
    console.error("Error GET /proveedor/:id/export:", error);
    return applyCorsHeaders(NextResponse.json({ error: "Error al exportar proveedor" }, { status: 500 }));
  }
}
