import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  listarProductos,
  listarProductosPaginado,
  type ListarProductosPaginadoParams,
} from "./productoService";

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

const escapeCsv = (value: unknown): string => {
  const raw = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[\r\n,\"]/g.test(raw);
  const escaped = raw.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
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
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let ctx: PdfCtx = newPage({ pdf, font, bold });

  const now = new Date();
  const title = scope === "all" ? "Productos (Todos)" : "Productos (Página actual)";
  drawText(ctx, title, PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;
  drawText(ctx, `Generado: ${now.toLocaleString("es-EC")}`, PDF_MARGIN, ctx.y, 10, false, rgb(0.4, 0.4, 0.4));
  ctx.y -= 18;

  const col = {
    codigo: { x: PDF_MARGIN, w: 90 },
    nombre: { x: PDF_MARGIN + 92, w: 190 },
    proveedor: { x: PDF_MARGIN + 92 + 192, w: 150 },
    stock: { x: A4.width - PDF_MARGIN - 60, w: 60 },
  };

  const drawHeader = () => {
    ensureSpace(ctx, 22);
    drawText(ctx, "Código", col.codigo.x, ctx.y, 10, true);
    drawText(ctx, "Producto", col.nombre.x, ctx.y, 10, true);
    drawText(ctx, "Proveedor", col.proveedor.x, ctx.y, 10, true);
    const stockLabel = "Stock";
    const w = bold.widthOfTextAtSize(stockLabel, 10);
    drawText(ctx, stockLabel, col.stock.x + col.stock.w - w, ctx.y, 10, true);
    ctx.y -= 14;
    // línea
    ctx.page.drawLine({
      start: { x: PDF_MARGIN, y: ctx.y },
      end: { x: A4.width - PDF_MARGIN, y: ctx.y },
      thickness: 1,
      color: rgb(0.89, 0.91, 0.94),
    });
    ctx.y -= 10;
  };

  drawHeader();

  const rowSize = 9;
  const rowHeight = 14;

  for (const r of rows) {
    ensureSpace(ctx, rowHeight + 6);
    const y = ctx.y;

    const codigo = truncateToWidth(font, rowSize, r.codigo_producto, col.codigo.w);
    const nombre = truncateToWidth(font, rowSize, r.nombre_producto, col.nombre.w);
    const proveedor = truncateToWidth(font, rowSize, r.proveedor, col.proveedor.w);
    const stock = String(r.stock ?? 0);

    drawText(ctx, codigo, col.codigo.x, y, rowSize);
    drawText(ctx, nombre, col.nombre.x, y, rowSize);
    drawText(ctx, proveedor, col.proveedor.x, y, rowSize);

    const stockW = font.widthOfTextAtSize(stock, rowSize);
    drawText(ctx, stock, col.stock.x + col.stock.w - stockW, y, rowSize);

    ctx.y -= rowHeight;
    if (ctx.y < PDF_MARGIN + 40) {
      ctx = newPage({ pdf, font, bold });
      drawHeader();
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
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
  const valueX = PDF_MARGIN + 140;
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

function buildExportRowsFromItems(items: any[]): ExportRow[] {
  return items.map((p) => {
    const precioVenta = toNumberOrNull(p.precio_venta) ?? 0;
    const compraRaw = toNumberOrNull(p.costo) ?? toNumberOrNull(p.precio_compra);
    const precioCompra = compraRaw !== null && compraRaw > 0 ? compraRaw : null;

    const margenRaw = toNumberOrNull(p.margen);
    const margen = margenRaw !== null ? margenRaw : precioCompra === null ? null : precioVenta - precioCompra;

    const proveedorNombre =
      (p.proveedor_nombre as string | null | undefined) ??
      (p.proveedor?.nombre_proveedor as string | null | undefined) ??
      null;

    return {
      codigo_producto: String(p.codigo_producto ?? ""),
      nombre_producto: String(p.nombre_producto ?? ""),
      proveedor: proveedorNombre ?? "Sin proveedor",
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

    return { rows: buildExportRowsFromItems(productos as any[]), scope: "all" };
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

    const byId = new Map<number, any>(productos.map((p) => [p.id_producto, p]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    return { rows: buildExportRowsFromItems(ordered), scope: "page" };
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

  return { rows: buildExportRowsFromItems(payload.items as any[]), scope: "page" };
}

export async function exportProductsFile(query: ProductExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveProductsForExport(query);

  const filenameBase = scope === "all" ? "productos_all" : "productos_page";

  if (query.format === "csv") {
    const header = [
      "codigo_producto",
      "categoria",
      "nombre_producto",
      "proveedor",
      "precio_venta",
      "precio_compra",
      "margen",
      "stock",
      "stock_minimo",
    ];
    const lines = [header.join(",")];

    rows.forEach((r) => {
      const categoria = inferCategoryFromCode(r.codigo_producto) ?? "";
      lines.push(
        [
          escapeCsv(r.codigo_producto),
          escapeCsv(categoria),
          escapeCsv(r.nombre_producto),
          escapeCsv(r.proveedor),
          escapeCsv(r.precio_venta),
          escapeCsv(r.precio_compra ?? ""),
          escapeCsv(r.margen ?? ""),
          escapeCsv(r.stock),
          escapeCsv(r.stock_minimo),
        ].join(",")
      );
    });

    const csv = `\ufeff${lines.join("\r\n")}`;
    return {
      buffer: Buffer.from(csv, "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: `${filenameBase}.csv`,
    };
  }

  if (query.format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Productos", { views: [{ state: "frozen", ySplit: 1 }] });

    sheet.columns = [
      { header: "Código", key: "codigo", width: 18 },
      { header: "Categoría", key: "categoria", width: 12 },
      { header: "Nombre", key: "nombre", width: 34 },
      { header: "Proveedor", key: "proveedor", width: 24 },
      { header: "Precio venta", key: "precio_venta", width: 14 },
      { header: "Precio compra", key: "precio_compra", width: 14 },
      { header: "Margen", key: "margen", width: 12 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Stock mínimo", key: "stock_minimo", width: 12 },
    ];

    sheet.getRow(1).font = { bold: true };

    rows.forEach((r) => {
      sheet.addRow({
        codigo: r.codigo_producto,
        categoria: inferCategoryFromCode(r.codigo_producto) ?? "",
        nombre: r.nombre_producto,
        proveedor: r.proveedor,
        precio_venta: r.precio_venta,
        precio_compra: r.precio_compra ?? "",
        margen: r.margen ?? "",
        stock: r.stock,
        stock_minimo: r.stock_minimo,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
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
