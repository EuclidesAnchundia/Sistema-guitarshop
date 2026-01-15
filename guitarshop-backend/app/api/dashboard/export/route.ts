import { NextResponse } from "next/server";
import { optionsCors, jsonCors, applyCorsHeaders } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import { generateDashboardReportPdf } from "../../../../src/modules/dashboard/application/dashboardReportPdf";
import type { DashboardExportRange } from "../../../../src/modules/dashboard/application/dashboardService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/dashboard/export?format=pdf&range=current|7d|month
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "").toLowerCase();
    const range = (url.searchParams.get("range") ?? "").toLowerCase();

    if (format !== "pdf") {
      return jsonCors({ error: "Formato no soportado" }, { status: 400 });
    }

    if (range !== "current" && range !== "7d" && range !== "month") {
      return jsonCors({ error: "Rango inválido" }, { status: 400 });
    }

    const pdfBytes = await generateDashboardReportPdf(range as DashboardExportRange);
    const body = Uint8Array.from(pdfBytes);

    const filename =
      range === "current" ? "dashboard_current.pdf" : range === "7d" ? "dashboard_7d.pdf" : "dashboard_month.pdf";

    const res = new NextResponse(body, { status: 200 });
    res.headers.set("Content-Type", "application/pdf");
    res.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return applyCorsHeaders(res);
  } catch (err) {
    console.error("Error GET /api/dashboard/export:", err);
    return jsonCors({ error: "Error al generar el reporte del dashboard" }, { status: 500 });
  }
}
