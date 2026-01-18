import prisma from "../../../shared/prisma/prismaClient";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { exportTableToCsv, exportTableToPdf, exportTableToXlsx, type TableColumn } from "../../../shared/export/tableExport";

import { listarProductosPaginado, type ListarProductosPaginadoParams } from "./productoService";

export type ProductExportFormat = "csv" | "xlsx" | "pdf";
export type ProductExportScope = "page" | "all";

export type ProductExportQuery = {
  format: ProductExportFormat;
  scope: ProductExportScope;

  page?: number;
  perPage?: number;
  search?: string | null;
  sortKey?: ListarProductosPaginadoParams["sortKey"];
  categoryPrefix?: string | null;
  providerId?: number | null;
  stockStatus?: ListarProductosPaginadoParams["stockStatus"];

  // Para cumplir “exportar exactamente lo visible”, el frontend puede enviar IDs visibles.
  ids?: number[];
};

type ExportRow = {
  codigo_producto: string;
  nombre_producto: string;
  proveedor: string;
  precio_venta: number;
  precio_compra: number | null;
  margen: number | null;
  stock: number;
  stock_minimo: number;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferCategoryFromCode = (code: string): string | null => {
  const match = code?.toUpperCase().match(/^([A-Z]{3})-/);
  return match ? match[1] : null;
};

const A4 = { width: 595.28, height: 841.89 };
const PDF_MARGIN = 48;

const truncateToWidth = (font: PDFFont, size: number, text: string, maxWidth: number) => {
  const normalized = (text ?? "").toString();
  if (!normalized) return "";
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  const ellipsis = "…";
  let low = 0;
  let high = normalized.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = normalized.slice(0, mid) + ellipsis;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return normalized.slice(0, Math.max(0, low)) + ellipsis;
};

type PdfCtx = {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
};

const newPage = (ctx: Omit<PdfCtx, "page" | "y">): PdfCtx => {
  const page = ctx.pdf.addPage([A4.width, A4.height]);
  return { ...ctx, page, y: A4.height - PDF_MARGIN };
};

const drawText = (ctx: PdfCtx, text: string, x: number, y: number, size: number, bold = false, color = rgb(0, 0, 0)) => {
  ctx.page.drawText(text, { x, y, size, font: bold ? ctx.bold : ctx.font, color });
};

const ensureSpace = (ctx: PdfCtx, needed: number) => {
  if (ctx.y - needed < PDF_MARGIN) {
    const next = newPage({ pdf: ctx.pdf, font: ctx.font, bold: ctx.bold });
    ctx.page = next.page;
    ctx.y = next.y;
  }
};

async function buildProductsPdf(rows: ExportRow[], scope: ProductExportScope): Promise<Buffer> {
  const title = scope === "all" ? "Productos (Todos)" : "Productos (Página actual)";
  const columns: TableColumn<ExportRow>[] = [
    { header: "Código", widthWeight: 1.0, value: (r) => r.codigo_producto },
    { header: "Categoría", widthWeight: 0.8, value: (r) => inferCategoryFromCode(r.codigo_producto) ?? "" },
    { header: "Producto", widthWeight: 2.2, value: (r) => r.nombre_producto },
    { header: "Proveedor", widthWeight: 1.6, value: (r) => r.proveedor },
    { header: "Precio venta", align: "right", widthWeight: 1.0, value: (r) => r.precio_venta },
    { header: "Stock", align: "right", widthWeight: 0.7, value: (r) => r.stock },
  ];

  return exportTableToPdf({
    title,
    subtitle: `Registros: ${rows.length} · Generado: ${new Date().toLocaleString("es-EC")}`,
    rows,
    columns,
  });
}

async function buildSingleProductPdfDoc(params: {
  codigo: string;
  nombre: string;
  categoria: string;
  proveedor: string;
  precioVenta: number;
  precioCompra: number | null;
  stock: number;
  stockMinimo: number;
  estado: string;
  descripcion: string | null;
  movimientos: Array<{ tipo: string; fecha: string; cantidad: number }>;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let ctx: PdfCtx = newPage({ pdf, font, bold });

  drawText(ctx, params.nombre || "Producto", PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;
  drawText(ctx, `Código: ${params.codigo}`, PDF_MARGIN, ctx.y, 11, false, rgb(0.4, 0.4, 0.4));
  ctx.y -= 20;

  drawText(ctx, "Datos generales", PDF_MARGIN, ctx.y, 12, true);
  ctx.y -= 16;

  const rows: Array<[string, string]> = [
    ["Categoría", params.categoria],
    ["Proveedor", params.proveedor],
    ["Precio venta", String(params.precioVenta)],
    ["Precio compra", params.precioCompra === null ? "—" : String(params.precioCompra)],
    ["Stock", String(params.stock)],
    ["Stock mínimo", String(params.stockMinimo)],
    ["Estado", params.estado],
  ];

  const labelW = 120;
  const gap = 20;
  const valueX = PDF_MARGIN + labelW + gap;
  for (const [label, value] of rows) {
    ensureSpace(ctx, 14);
    drawText(ctx, `${label}:`, PDF_MARGIN, ctx.y, 10, true);
    const fitted = truncateToWidth(font, 10, value, A4.width - PDF_MARGIN - valueX);
    drawText(ctx, fitted, valueX, ctx.y, 10, false);
    ctx.y -= 14;
  }

  if (params.descripcion?.trim()) {
    ctx.y -= 8;
    ensureSpace(ctx, 40);
    drawText(ctx, "Descripción", PDF_MARGIN, ctx.y, 11, true);
    ctx.y -= 14;
    const desc = params.descripcion.trim();
    // texto simple en una línea truncada para evitar layout complejo
    drawText(ctx, truncateToWidth(font, 10, desc, A4.width - PDF_MARGIN * 2), PDF_MARGIN, ctx.y, 10);
    ctx.y -= 18;
  } else {
    ctx.y -= 8;
  }

  ensureSpace(ctx, 40);
  drawText(ctx, "Historial de movimientos", PDF_MARGIN, ctx.y, 12, true);
  ctx.y -= 16;

  const cols = {
    tipo: { x: PDF_MARGIN, w: 160 },
    fecha: { x: PDF_MARGIN + 170, w: 240 },
    cantidad: { x: A4.width - PDF_MARGIN - 70, w: 70 },
  };

  const drawMovHeader = () => {
    ensureSpace(ctx, 22);
    drawText(ctx, "Tipo", cols.tipo.x, ctx.y, 10, true);
    drawText(ctx, "Fecha", cols.fecha.x, ctx.y, 10, true);
    const label = "Cantidad";
    const w = bold.widthOfTextAtSize(label, 10);
    drawText(ctx, label, cols.cantidad.x + cols.cantidad.w - w, ctx.y, 10, true);
    ctx.y -= 14;
    ctx.page.drawLine({
      start: { x: PDF_MARGIN, y: ctx.y },
      end: { x: A4.width - PDF_MARGIN, y: ctx.y },
      thickness: 1,
      color: rgb(0.89, 0.91, 0.94),
    });
    ctx.y -= 10;
  };

  drawMovHeader();

  if (params.movimientos.length === 0) {
    drawText(ctx, "No hay movimientos registrados.", PDF_MARGIN, ctx.y, 10, false, rgb(0.4, 0.4, 0.4));
    ctx.y -= 14;
  } else {
    for (const m of params.movimientos) {
      ensureSpace(ctx, 20);
      const y = ctx.y;
      drawText(ctx, truncateToWidth(font, 9, m.tipo, cols.tipo.w), cols.tipo.x, y, 9);
      drawText(ctx, truncateToWidth(font, 9, m.fecha, cols.fecha.w), cols.fecha.x, y, 9);
      const qty = String(m.cantidad ?? 0);
      const w = font.widthOfTextAtSize(qty, 9);
      drawText(ctx, qty, cols.cantidad.x + cols.cantidad.w - w, y, 9);
      ctx.y -= 14;
      if (ctx.y < PDF_MARGIN + 40) {
        ctx = newPage({ pdf, font, bold });
        drawMovHeader();
      }
    }
  }

  const now = new Date();
  ensureSpace(ctx, 18);
  drawText(ctx, `Generado: ${now.toLocaleString("es-EC")}`, PDF_MARGIN, PDF_MARGIN - 10, 9, false, rgb(0.4, 0.4, 0.4));

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

type ProductoExportItem = {
  id_producto: number;
  codigo_producto: unknown;
  nombre_producto: unknown;
  proveedor?: { nombre_proveedor: unknown } | null;
  proveedor_nombre?: unknown;
  precio_venta?: unknown;
  precio_compra?: unknown;
  costo?: unknown;
  margen?: unknown;
  cantidad_stock?: unknown;
  stock_minimo?: unknown;
};

function buildExportRowsFromItems(items: ProductoExportItem[]): ExportRow[] {
  return items.map((p) => {
    const precioVenta = toNumberOrNull(p.precio_venta) ?? 0;
    const compraRaw = toNumberOrNull(p.costo) ?? toNumberOrNull(p.precio_compra);
    const precioCompra = compraRaw !== null && compraRaw > 0 ? compraRaw : null;

    const margenRaw = toNumberOrNull(p.margen);
    const margen = margenRaw !== null ? margenRaw : precioCompra === null ? null : precioVenta - precioCompra;

    const proveedorNombre = (p.proveedor_nombre ?? p.proveedor?.nombre_proveedor ?? null) as unknown;

    return {
      codigo_producto: String(p.codigo_producto ?? ""),
      nombre_producto: String(p.nombre_producto ?? ""),
      proveedor: proveedorNombre ? String(proveedorNombre) : "Sin proveedor",
      precio_venta: precioVenta,
      precio_compra: precioCompra,
      margen,
      stock: Number(p.cantidad_stock ?? 0),
      stock_minimo: Number(p.stock_minimo ?? 0),
    };
  });
}

async function resolveProductsForExport(query: ProductExportQuery): Promise<{ rows: ExportRow[]; scope: ProductExportScope }> {
  if (query.scope === "all") {
    const productos = await prisma.producto.findMany({
      select: {
        id_producto: true,
        codigo_producto: true,
        nombre_producto: true,
        descripcion: true,
        precio_compra: true,
        precio_venta: true,
        cantidad_stock: true,
        stock_minimo: true,
        id_estado: true,
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_proveedor: true,
          },
        },
      },
      orderBy: { id_producto: "asc" },
    });

    return { rows: buildExportRowsFromItems(productos as unknown as ProductoExportItem[]), scope: "all" };
  }

  // scope=page
  if (query.ids && query.ids.length > 0) {
    // Para exportar exactamente el snapshot visible (incluye filtros/sort/paginación cliente).
    const ids = Array.from(new Set(query.ids)).filter((id) => Number.isFinite(id) && id > 0);
    const productos = await prisma.producto.findMany({
      where: { id_producto: { in: ids } },
      select: {
        id_producto: true,
        codigo_producto: true,
        nombre_producto: true,
        descripcion: true,
        precio_compra: true,
        precio_venta: true,
        cantidad_stock: true,
        stock_minimo: true,
        id_estado: true,
        proveedor: { select: { nombre_proveedor: true } },
      },
    });

    const byId = new Map<number, ProductoExportItem>(
      (productos as unknown as ProductoExportItem[]).map((p) => [p.id_producto, p])
    );
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    return { rows: buildExportRowsFromItems(ordered as ProductoExportItem[]), scope: "page" };
  }

  const page = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page!)) : 1;
  const perPage = Number.isFinite(query.perPage) ? Math.max(1, Math.min(200, Math.floor(query.perPage!))) : 20;

  const payload = await listarProductosPaginado({
    page,
    pageSize: perPage,
    search: query.search ?? null,
    categoryPrefix: query.categoryPrefix ?? null,
    providerId: query.providerId ?? null,
    stockStatus: query.stockStatus,
    sortKey: query.sortKey,
  });

  return { rows: buildExportRowsFromItems(payload.items as unknown as ProductoExportItem[]), scope: "page" };
}

export async function exportProductsFile(query: ProductExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveProductsForExport(query);

  const filenameBase = scope === "all" ? "productos_all" : "productos_page";

  const tableColumns: TableColumn<ExportRow>[] = [
    { header: "Código", widthWeight: 1.1, value: (r) => r.codigo_producto },
    { header: "Categoría", widthWeight: 0.8, value: (r) => inferCategoryFromCode(r.codigo_producto) ?? "" },
    { header: "Producto", widthWeight: 2.4, value: (r) => r.nombre_producto },
    { header: "Proveedor", widthWeight: 1.8, value: (r) => r.proveedor },
    { header: "Precio venta", align: "right", widthWeight: 1.0, value: (r) => r.precio_venta },
    { header: "Precio compra", align: "right", widthWeight: 1.0, value: (r) => r.precio_compra },
    { header: "Margen", align: "right", widthWeight: 0.9, value: (r) => r.margen },
    { header: "Stock", align: "right", widthWeight: 0.7, value: (r) => r.stock },
    { header: "Stock mínimo", align: "right", widthWeight: 0.9, value: (r) => r.stock_minimo },
  ];

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, tableColumns);
    return {
      buffer,
      contentType: "text/csv; charset=utf-8",
      filename: `${filenameBase}.csv`,
    };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Productos", rows, columns: tableColumns });
    return {
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${filenameBase}.xlsx`,
    };
  }

  const buffer = await buildProductsPdf(rows, scope);

  return {
    buffer,
    contentType: "application/pdf",
    filename: `${filenameBase}.pdf`,
  };
}

export async function exportSingleProductPdf(productId: number, movementsLimit = 50): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("PRODUCT_ID_INVALID");
  }

  const producto = await prisma.producto.findUnique({
    where: { id_producto: id },
    select: {
      id_producto: true,
      codigo_producto: true,
      nombre_producto: true,
      descripcion: true,
      precio_compra: true,
      precio_venta: true,
      cantidad_stock: true,
      stock_minimo: true,
      id_estado: true,
      proveedor: { select: { nombre_proveedor: true } },
    },
  });

  if (!producto) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const movimientos = await prisma.kardex.findMany({
    where: { id_producto: id },
    orderBy: { fecha_movimiento: "desc" },
    take: Math.max(1, Math.min(200, movementsLimit)),
    select: {
      tipo_movimiento: true,
      fecha_movimiento: true,
      cantidad: true,
    },
  });

  const codigo = producto.codigo_producto ?? String(producto.id_producto);
  const safeCode = String(codigo).replace(/[^a-zA-Z0-9_-]+/g, "_");

  const categoria = inferCategoryFromCode(codigo) ?? "N/D";
  const proveedor = producto.proveedor?.nombre_proveedor ?? "Sin proveedor";
  const precioVenta = toNumberOrNull(producto.precio_venta) ?? 0;
  const compraRaw = toNumberOrNull(producto.precio_compra);
  const compra = compraRaw !== null && compraRaw > 0 ? compraRaw : null;

  const estado = producto.id_estado === 1 ? "ACTIVO" : `ID=${producto.id_estado}`;
  const movimientosDto = movimientos.map((m) => ({
    tipo: String(m.tipo_movimiento ?? "—"),
    fecha: m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleString("es-EC") : "—",
    cantidad: Number(m.cantidad ?? 0),
  }));

  const buffer = await buildSingleProductPdfDoc({
    codigo,
    nombre: producto.nombre_producto ?? "Producto",
    categoria,
    proveedor,
    precioVenta,
    precioCompra: compra,
    stock: Number(producto.cantidad_stock ?? 0),
    stockMinimo: Number(producto.stock_minimo ?? 0),
    estado,
    descripcion: producto.descripcion ?? null,
    movimientos: movimientosDto,
  });

  return { buffer, filename: `producto_${safeCode}.pdf` };
}
