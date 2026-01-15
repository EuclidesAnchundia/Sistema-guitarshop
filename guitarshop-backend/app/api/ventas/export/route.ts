import { NextResponse } from "next/server";
import { optionsCors, applyCorsHeaders } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import { exportVentasFile } from "../../../../lib/services/ventasExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsCors();
}

const parseIds = (value: string | null): number[] | undefined => {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : undefined;
};

export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return applyCorsHeaders(NextResponse.json({ error: auth.message ?? "Token inválido" }, { status: 401 }));
  }

  if (!hasAdminRole(auth)) {
    return applyCorsHeaders(NextResponse.json({ error: "Solo administradores pueden exportar ventas" }, { status: 403 }));
  }

  try {
    const url = new URL(req.url);
    const formatRaw = (url.searchParams.get("format") ?? "pdf").toLowerCase();
    const scopeRaw = (url.searchParams.get("scope") ?? "page").toLowerCase();

    const format = (formatRaw === "csv" || formatRaw === "xlsx" || formatRaw === "pdf" ? formatRaw : "pdf") as
      | "csv"
      | "xlsx"
      | "pdf";
    const scope = (scopeRaw === "all" ? "all" : "page") as "page" | "all";
    const ids = parseIds(url.searchParams.get("ids"));

    const { buffer, contentType, filename } = await exportVentasFile({ format, scope, ids });

    const res = new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

    applyCorsHeaders(res);
    return res;
  } catch (error) {
    console.error("Error GET /ventas/export:", error);
    return applyCorsHeaders(NextResponse.json({ error: "Error al exportar ventas" }, { status: 500 }));
  }
}
