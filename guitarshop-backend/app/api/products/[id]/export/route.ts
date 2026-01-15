import { NextResponse } from "next/server";

import { optionsCors, applyCorsHeaders } from "../../../../../lib/cors";
import { verifyToken } from "../../../../../lib/auth";
import { exportSingleProductPdf } from "../../../../../lib/services/productoService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 2];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/products/:id/export?format=pdf
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return applyCorsHeaders(
      NextResponse.json({ error: auth.message ?? "Token inválido" }, { status: 401 })
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return applyCorsHeaders(NextResponse.json({ error: "ID inválido" }, { status: 400 }));
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "pdf";
    if (format !== "pdf") {
      return applyCorsHeaders(
        NextResponse.json({ error: "Formato inválido" }, { status: 400 })
      );
    }

    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;

    const { buffer, filename } = await exportSingleProductPdf(id, limit);

    const res = new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });

    return applyCorsHeaders(res);
  } catch (error: unknown) {
    console.error("Error GET /api/products/:id/export", error);

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return applyCorsHeaders(
        NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
      );
    }

    return applyCorsHeaders(
      NextResponse.json({ error: "Error al exportar producto" }, { status: 500 })
    );
  }
}
