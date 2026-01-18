import { NextResponse } from "next/server";

import { optionsCors, applyCorsHeaders } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import {
  exportProductsFile,
  type ProductExportFormat,
  type ProductExportScope,
  type ProductExportQuery,
} from "../../../../lib/services/productoService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseFormat = (value: string | null): ProductExportFormat | null => {
  if (value === "csv" || value === "xlsx" || value === "pdf") return value;
  return null;
};

const parseScope = (value: string | null): ProductExportScope | null => {
  if (value === "page" || value === "all") return value;
  return null;
};

const parseIds = (value: string | null): number[] | undefined => {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((chunk) => Number(chunk.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
};

const parseStockStatus = (value: string | null): ProductExportQuery["stockStatus"] | undefined => {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "all" || v === "normal" || v === "low" || v === "critical" || v === "risk") return v;
  return undefined;
};

const parseSortKey = (value: string | null): ProductExportQuery["sortKey"] | undefined => {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "name-asc" || v === "name-desc" || v === "stock-asc" || v === "stock-desc" || v === "margin-desc") return v;
  return undefined;
};

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/products/export?format=csv|xlsx|pdf&scope=page|all&page=1&perPage=10&search=...&sort=...&<otros filtros>
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return applyCorsHeaders(
      NextResponse.json({ error: auth.message ?? "Token inválido" }, { status: 401 })
    );
  }

  try {
    const url = new URL(req.url);

    const format = parseFormat(url.searchParams.get("format"));
    const scope = parseScope(url.searchParams.get("scope"));

    if (!format || !scope) {
      return applyCorsHeaders(
        NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 })
      );
    }

    const pageRaw = url.searchParams.get("page");
    const perPageRaw = url.searchParams.get("perPage") ?? url.searchParams.get("pageSize");

    const providerIdRaw = url.searchParams.get("providerId");
    const providerId = providerIdRaw ? Number(providerIdRaw) : null;
    const providerIdNormalized = providerId && Number.isFinite(providerId) && providerId > 0 ? providerId : null;

    const query: ProductExportQuery = {
      format,
      scope,

      // Solo aplica a scope=page
      page: pageRaw ? Number(pageRaw) : undefined,
      perPage: perPageRaw ? Number(perPageRaw) : undefined,
      search: url.searchParams.get("search"),
      sortKey: parseSortKey(url.searchParams.get("sortKey")),
      categoryPrefix: url.searchParams.get("categoryPrefix"),
      providerId: providerIdNormalized,
      stockStatus: parseStockStatus(url.searchParams.get("stockStatus")),

      // Snapshot (si el frontend lo envía)
      ids: parseIds(url.searchParams.get("ids")),
    };

    const { buffer, contentType, filename } = await exportProductsFile(query);

    const res = new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });

    return applyCorsHeaders(res);
  } catch (error) {
    console.error("Error GET /api/products/export", error);
    return applyCorsHeaders(
      NextResponse.json({ error: "Error al exportar productos" }, { status: 500 })
    );
  }
}
