import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportScope = "page" | "all";

export type PdfAlign = "left" | "right";

export type ColumnKind = "text" | "integer" | "number" | "currency" | "date" | "datetime" | "boolean";

export type TableColumn<Row> = {
  header: string;
  align?: PdfAlign;
  widthWeight?: number;
  value: (row: Row) => unknown;
  kind?: ColumnKind;
};

const A4 = { width: 595.28, height: 841.89 };
const PDF_MARGIN = 48;

const PDF_HEADER_BG = rgb(0.95, 0.96, 0.98);
const PDF_GRID = rgb(0.89, 0.91, 0.94);
const PDF_SUBTLE = rgb(0.4, 0.4, 0.4);

const escapeCsv = (value: unknown): string => {
  const raw = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[\r\n,\"]/g.test(raw);
  const escaped = raw.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const toIsoLike = (date: Date): string => {
  // ISO recortado, más legible que el ISO completo, y estable para Excel/CSV.
  // Ej: 2026-01-17 13:45:10
  return date.toISOString().replace("T", " ").slice(0, 19);
};

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value instanceof Date) return toIsoLike(value);
  return String(value);
};

const isValidDate = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

const guessKindFromHeader = (header: string): ColumnKind => {
  const h = (header ?? "").toLowerCase();
  if (/\b(fecha|registro|emitid|cread|actualiz)\b/.test(h)) return "datetime";
  if (/\b(precio|subtotal|impuesto|iva|total|monto|valor|saldo|deuda|abono|pago)\b/.test(h)) return "currency";
  if (/\b(id|cant\.|cant|cantidad|stock|cuota|num(ero)?|n\u00fam(ero)?)\b/.test(h)) return "integer";
  if (/\b(estado)\b/.test(h)) return "text";
  return "text";
};

const resolveKind = <Row>(col: TableColumn<Row>): ColumnKind => col.kind ?? guessKindFromHeader(col.header);

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDateOrNull = (value: unknown): Date | null => {
  if (isValidDate(value)) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatNumberEc = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 });
const formatIntegerEc = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
const formatCurrencyEc = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const formatForPdf = (kind: ColumnKind, value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (kind === "boolean") {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return toCellString(value);
  }

  if (kind === "date" || kind === "datetime") {
    const d = toDateOrNull(value);
    if (!d) return toCellString(value);
    return d.toLocaleString("es-EC");
  }

  if (kind === "currency") {
    const n = toNumberOrNull(value);
    return n === null ? toCellString(value) : formatCurrencyEc.format(n);
  }

  if (kind === "integer") {
    const n = toNumberOrNull(value);
    return n === null ? toCellString(value) : formatIntegerEc.format(n);
  }

  if (kind === "number") {
    const n = toNumberOrNull(value);
    return n === null ? toCellString(value) : formatNumberEc.format(n);
  }

  return toCellString(value);
};

export function makeExportFilename(base: string, scope: ExportScope, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  const scopeLabel = scope === "all" ? "todos" : "pagina";
  return `${base}_${scopeLabel}_${date}.${format}`;
}

export async function exportTableToCsv<Row>(rows: Row[], columns: TableColumn<Row>[]): Promise<Buffer> {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const kind = resolveKind(c);
        // Para CSV: preferimos strings estables. Fechas se convierten a ISO recortado.
        const raw = c.value(row);
        if (kind === "date" || kind === "datetime") {
          const d = toDateOrNull(raw);
          return escapeCsv(d ? toIsoLike(d) : toCellString(raw));
        }
        return escapeCsv(toCellString(raw));
      })
      .join(",")
  );
  const bom = "\uFEFF";
  const csv = [header, ...lines].join("\r\n");
  return Buffer.from(bom + csv, "utf8");
}

export async function exportTableToXlsx<Row>(params: {
  sheetName: string;
  rows: Row[];
  columns: TableColumn<Row>[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Guitarshop";

  // Hoja de metadatos (no afecta la hoja principal para filtros/pivots).
  const info = workbook.addWorksheet("Info");
  info.columns = [
    { header: "Campo", key: "k", width: 20 },
    { header: "Valor", key: "v", width: 60 },
  ];
  info.getRow(1).font = { bold: true };
  info.addRow({ k: "Reporte", v: params.sheetName });
  info.addRow({ k: "Generado", v: new Date().toLocaleString("es-EC") });
  info.addRow({ k: "Filas", v: params.rows.length });
  info.addRow({ k: "Columnas", v: params.columns.length });

  const worksheet = workbook.addWorksheet(params.sheetName);

  worksheet.columns = params.columns.map((c, idx) => {
    const kind = resolveKind(c);
    const inferredAlign: ExcelJS.Alignment["horizontal"] =
      c.align === "right" || kind === "currency" || kind === "integer" || kind === "number" ? "right" : "left";

    return {
      header: c.header,
      key: String(idx),
      width: Math.max(12, Math.min(42, Math.round((c.widthWeight ?? 1) * 14))),
      style: {
        alignment: { horizontal: inferredAlign, vertical: "middle" },
      },
    };
  });

  params.rows.forEach((row) => {
    worksheet.addRow(
      params.columns.reduce<Record<string, unknown>>((acc, col, idx) => {
        const kind = resolveKind(col);
        const raw = col.value(row);

        if (kind === "currency" || kind === "integer" || kind === "number") {
          const n = toNumberOrNull(raw);
          acc[String(idx)] = n === null ? (raw ?? "") : n;
          return acc;
        }

        if (kind === "date" || kind === "datetime") {
          const d = toDateOrNull(raw);
          acc[String(idx)] = d ?? (raw ?? "");
          return acc;
        }

        acc[String(idx)] = raw ?? "";
        return acc;
      }, {})
    );
  });

  // Estilos cabecera
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 18;

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Bordes y formatos por columna
  const colCount = params.columns.length;
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };

  for (let i = 0; i < colCount; i += 1) {
    const col = params.columns[i];
    const kind = resolveKind(col);
    const columnNumber = i + 1;
    const excelCol = worksheet.getColumn(columnNumber);

    if (kind === "currency") excelCol.numFmt = "$#,##0.00";
    else if (kind === "integer") excelCol.numFmt = "#,##0";
    else if (kind === "number") excelCol.numFmt = "#,##0.00";
    else if (kind === "date") excelCol.numFmt = "yyyy-mm-dd";
    else if (kind === "datetime") excelCol.numFmt = "yyyy-mm-dd hh:mm";

    excelCol.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      if (rowNumber === 1) return;
      // Zebra (solo datos)
      if (rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
    });
  }

  // Ajuste de ancho basado en contenido (limitado)
  for (let i = 0; i < colCount; i += 1) {
    const columnNumber = i + 1;
    const excelCol = worksheet.getColumn(columnNumber);
    const headerText = String(params.columns[i].header ?? "");
    let maxLen = Math.min(60, headerText.length);
    excelCol.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === 1) return;
      const s = String(cell.text ?? "");
      maxLen = Math.max(maxLen, Math.min(60, s.length));
    });
    excelCol.width = Math.max(excelCol.width ?? 12, Math.min(50, maxLen + 2));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

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

const drawText = (
  ctx: PdfCtx,
  text: string,
  x: number,
  y: number,
  size: number,
  bold = false,
  color = rgb(0, 0, 0)
) => {
  ctx.page.drawText(text, { x, y, size, font: bold ? ctx.bold : ctx.font, color });
};

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

const ensureSpace = (ctx: PdfCtx, needed: number) => {
  if (ctx.y - needed < PDF_MARGIN) {
    const next = newPage({ pdf: ctx.pdf, font: ctx.font, bold: ctx.bold });
    ctx.page = next.page;
    ctx.y = next.y;
  }
};

export async function exportTableToPdf<Row>(params: {
  title: string;
  subtitle?: string;
  rows: Row[];
  columns: TableColumn<Row>[];
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let ctx: PdfCtx = newPage({ pdf, font, bold });

  drawText(ctx, params.title, PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;

  const subtitle = params.subtitle ?? `Generado: ${new Date().toLocaleString("es-EC")}`;
  drawText(ctx, subtitle, PDF_MARGIN, ctx.y, 10, false, PDF_SUBTLE);
  ctx.y -= 18;

  const availableWidth = A4.width - PDF_MARGIN * 2;
  const weights = params.columns.map((c) => Math.max(0.2, c.widthWeight ?? 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / weightSum) * availableWidth);

  const xs: number[] = [];
  let cursor = PDF_MARGIN;
  for (let i = 0; i < widths.length; i += 1) {
    xs.push(cursor);
    cursor += widths[i];
  }

  const headerSize = 10;
  const rowSize = 9;
  const rowHeight = 14;

  const drawHeader = () => {
    ensureSpace(ctx, 28);

    // Fondo de cabecera
    ctx.page.drawRectangle({
      x: PDF_MARGIN,
      y: ctx.y - 2,
      width: availableWidth,
      height: 14,
      color: PDF_HEADER_BG,
      borderColor: PDF_GRID,
      borderWidth: 0.5,
    });

    for (let i = 0; i < params.columns.length; i += 1) {
      const col = params.columns[i];
      const x = xs[i];
      const w = widths[i];
      const header = truncateToWidth(bold, headerSize, col.header, w);
      if (col.align === "right") {
        const tw = bold.widthOfTextAtSize(header, headerSize);
        drawText(ctx, header, x + w - tw, ctx.y, headerSize, true);
      } else {
        drawText(ctx, header, x, ctx.y, headerSize, true);
      }
    }
    ctx.y -= 14;
    ctx.page.drawLine({
      start: { x: PDF_MARGIN, y: ctx.y },
      end: { x: A4.width - PDF_MARGIN, y: ctx.y },
      thickness: 1,
      color: PDF_GRID,
    });
    ctx.y -= 10;
  };

  drawHeader();

  let rowIndex = 0;
  for (const row of params.rows) {
    ensureSpace(ctx, rowHeight + 8);
    const y = ctx.y;

    // Zebra
    if (rowIndex % 2 === 1) {
      ctx.page.drawRectangle({
        x: PDF_MARGIN,
        y: y - 2,
        width: availableWidth,
        height: rowHeight,
        color: rgb(0.985, 0.988, 0.992),
      });
    }

    for (let i = 0; i < params.columns.length; i += 1) {
      const col = params.columns[i];
      const x = xs[i];
      const w = widths[i];
      const kind = resolveKind(col);
      const raw = formatForPdf(kind, col.value(row));
      const text = truncateToWidth(font, rowSize, raw, w);

      if (col.align === "right") {
        const tw = font.widthOfTextAtSize(text, rowSize);
        drawText(ctx, text, x + w - tw, y, rowSize);
      } else {
        drawText(ctx, text, x, y, rowSize);
      }
    }

    ctx.y -= rowHeight;

    // Línea sutil bajo la fila
    ctx.page.drawLine({
      start: { x: PDF_MARGIN, y: ctx.y + 2 },
      end: { x: A4.width - PDF_MARGIN, y: ctx.y + 2 },
      thickness: 0.5,
      color: PDF_GRID,
    });

    if (ctx.y < PDF_MARGIN + 40) {
      ctx = newPage({ pdf, font, bold });
      drawHeader();
    }

    rowIndex += 1;
  }

  // Numeración de páginas al final (ya conocemos el total)
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const label = `Página ${i + 1} de ${pages.length}`;
    page.drawText(label, {
      x: PDF_MARGIN,
      y: Math.max(16, PDF_MARGIN - 28),
      size: 9,
      font,
      color: PDF_SUBTLE,
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function exportSectionsToPdf(params: {
  title: string;
  subtitle?: string;
    sections: Array<{
    title: string;
    rows: unknown[];
    columns: TableColumn<unknown>[];
  }>;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let ctx: PdfCtx = newPage({ pdf, font, bold });

  drawText(ctx, params.title, PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;

  const subtitle = params.subtitle ?? `Generado: ${new Date().toLocaleString("es-EC")}`;
  drawText(ctx, subtitle, PDF_MARGIN, ctx.y, 10, false, PDF_SUBTLE);
  ctx.y -= 18;

  const drawTable = (rows: unknown[], columns: TableColumn<unknown>[]) => {
    const availableWidth = A4.width - PDF_MARGIN * 2;
    const weights = columns.map((c) => Math.max(0.2, c.widthWeight ?? 1));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / weightSum) * availableWidth);

    const xs: number[] = [];
    let cursor = PDF_MARGIN;
    for (let i = 0; i < widths.length; i += 1) {
      xs.push(cursor);
      cursor += widths[i];
    }

    const headerSize = 10;
    const rowSize = 9;
    const rowHeight = 14;

    const drawHeader = () => {
      ensureSpace(ctx, 28);

      ctx.page.drawRectangle({
        x: PDF_MARGIN,
        y: ctx.y - 2,
        width: availableWidth,
        height: 14,
        color: PDF_HEADER_BG,
        borderColor: PDF_GRID,
        borderWidth: 0.5,
      });

      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const x = xs[i];
        const w = widths[i];
        const header = truncateToWidth(bold, headerSize, col.header, w);
        if (col.align === "right") {
          const tw = bold.widthOfTextAtSize(header, headerSize);
          drawText(ctx, header, x + w - tw, ctx.y, headerSize, true);
        } else {
          drawText(ctx, header, x, ctx.y, headerSize, true);
        }
      }
      ctx.y -= 14;
      ctx.page.drawLine({
        start: { x: PDF_MARGIN, y: ctx.y },
        end: { x: A4.width - PDF_MARGIN, y: ctx.y },
        thickness: 1,
        color: PDF_GRID,
      });
      ctx.y -= 10;
    };

    drawHeader();

    let rowIndex = 0;
    for (const row of rows) {
      ensureSpace(ctx, rowHeight + 8);
      const y = ctx.y;

      if (rowIndex % 2 === 1) {
        ctx.page.drawRectangle({
          x: PDF_MARGIN,
          y: y - 2,
          width: availableWidth,
          height: rowHeight,
          color: rgb(0.985, 0.988, 0.992),
        });
      }

      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const x = xs[i];
        const w = widths[i];
        const kind = resolveKind(col);
        const raw = formatForPdf(kind, col.value(row));
        const text = truncateToWidth(font, rowSize, raw, w);

        if (col.align === "right") {
          const tw = font.widthOfTextAtSize(text, rowSize);
          drawText(ctx, text, x + w - tw, y, rowSize);
        } else {
          drawText(ctx, text, x, y, rowSize);
        }
      }

      ctx.y -= rowHeight;
      ctx.page.drawLine({
        start: { x: PDF_MARGIN, y: ctx.y + 2 },
        end: { x: A4.width - PDF_MARGIN, y: ctx.y + 2 },
        thickness: 0.5,
        color: PDF_GRID,
      });

      if (ctx.y < PDF_MARGIN + 40) {
        ctx = newPage({ pdf, font, bold });
        drawHeader();
      }

      rowIndex += 1;
    }
  };

  for (const section of params.sections) {
    ensureSpace(ctx, 28);
    drawText(ctx, section.title, PDF_MARGIN, ctx.y, 12, true);
    ctx.y -= 18;
    drawTable(section.rows, section.columns);
    ctx.y -= 14;
  }

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const label = `Página ${i + 1} de ${pages.length}`;
    page.drawText(label, {
      x: PDF_MARGIN,
      y: Math.max(16, PDF_MARGIN - 28),
      size: 9,
      font,
      color: PDF_SUBTLE,
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function exportKeyValueToPdf(params: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: unknown }>;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfCtx = newPage({ pdf, font, bold });

  drawText(ctx, params.title, PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;

  const subtitle = params.subtitle ?? `Generado: ${new Date().toLocaleString("es-EC")}`;
  drawText(ctx, subtitle, PDF_MARGIN, ctx.y, 10, false, PDF_SUBTLE);
  ctx.y -= 22;

  const labelW = 130;
  const gap = 10;
  const valueX = PDF_MARGIN + labelW + gap;
  const valueW = A4.width - PDF_MARGIN - valueX;

  const wrapToWidth = (text: string, size: number, maxWidth: number): string[] => {
    const normalized = (text ?? "").toString();
    if (!normalized) return ["—"];
    if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return [normalized];

    const words = normalized.split(/\s+/g).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      // palabra muy larga: truncar
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        lines.push(truncateToWidth(font, size, w, maxWidth));
        current = "";
      } else {
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : ["—"];
  };

  for (const row of params.rows) {
    const label = `${row.label}:`;
    const valueText = toCellString(row.value) || "—";
    const valueLines = wrapToWidth(valueText, 10, valueW);
    const blockHeight = Math.max(1, valueLines.length) * 14;
    ensureSpace(ctx, blockHeight);

    drawText(ctx, label, PDF_MARGIN, ctx.y, 10, true);
    for (let i = 0; i < valueLines.length; i += 1) {
      drawText(ctx, valueLines[i], valueX, ctx.y - i * 14, 10, false);
    }
    ctx.y -= blockHeight;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

type SaleInvoicePdfProducto = {
  nombre_producto?: string | null;
  codigo_producto?: string | null;
};

type SaleInvoicePdfDetalle = {
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal?: number | null;
  producto?: SaleInvoicePdfProducto | null;
};

type SaleInvoicePdfCliente = {
  nombres?: string | null;
  apellidos?: string | null;
  cedula?: string | null;
};

type SaleInvoicePdfUsuario = {
  nombre_completo?: string | null;
};

export type SaleInvoicePdfData = {
  numero_factura?: string | null;
  fecha_factura?: Date | string | null;
  forma_pago?: string | null;
  subtotal?: number | null;
  impuesto?: number | null;
  total?: number | null;
  cliente?: SaleInvoicePdfCliente | null;
  usuario?: SaleInvoicePdfUsuario | null;
  detalle_factura?: SaleInvoicePdfDetalle[] | null;
};

export async function exportSaleInvoiceToPdf(params: { sale: SaleInvoicePdfData }): Promise<Buffer> {
  const sale = params.sale;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 28.35; // ~10mm
  const pageW = A4.width;
  const pageH = A4.height;
  const contentW = pageW - margin * 2;

  const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
  const formatMoney = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(n) ? currency.format(n) : currency.format(0);
  };

  const asDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const d = asDate(sale.fecha_factura);
  const fecha = d
    ? d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "";
  const hora = d ? d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "";

  const clienteNombre = sale.cliente
    ? `${String(sale.cliente.nombres ?? "")} ${String(sale.cliente.apellidos ?? "")}`.trim().toUpperCase() ||
      "CONSUMIDOR FINAL"
    : "CONSUMIDOR FINAL";
  const clienteCedula = String(sale.cliente?.cedula ?? "9999999999");

  const ticketNo = String(sale.numero_factura ?? "001-000000");
  const atendidoPor = String(sale.usuario?.nombre_completo ?? "SISTEMA");
  const formaPago = String(sale.forma_pago ?? "EFECTIVO");

  const subtotal0 = 0;
  const subtotal15 = Number(sale.subtotal ?? 0);
  const iva15 = Number(sale.impuesto ?? 0);
  const total = Number(sale.total ?? 0);

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (
    text: string,
    x: number,
    y0: number,
    size: number,
    isBold = false,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(text, { x, y: y0, size, font: isBold ? bold : font, color });
  };

  const textW = (text: string, size: number, isBold = false) => (isBold ? bold : font).widthOfTextAtSize(text, size);
  const centerX = (text: string, size: number, isBold = false) => (pageW - textW(text, size, isBold)) / 2;

  const wrap = (raw: string, size: number, maxWidth: number): string[] => {
    const text = (raw ?? "").toString().trim();
    if (!text) return ["—"];
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return [text];

    const words = text.split(/\s+/g).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        lines.push(truncateToWidth(font, size, w, maxWidth));
        current = "";
      } else {
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : ["—"];
  };

  const ensure = (needed: number) => {
    const bottom = margin;
    if (y - needed < bottom) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
  };

  const rect = (x: number, yTop: number, w: number, h: number, borderWidth = 1.5) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth });
  };

  // ENCABEZADO (mismo texto que el layout de impresión)
  ensure(110);
  draw("GUITARSHOP", centerX("GUITARSHOP", 18, true), y - 18, 18, true);
  y -= 28;
  draw("RUC: 1234567890001", centerX("RUC: 1234567890001", 10), y, 10);
  y -= 14;
  draw("Av. Principal #123 y Secundaria", centerX("Av. Principal #123 y Secundaria", 10), y, 10);
  y -= 14;
  draw("Telf: 02-2345678 / 0998765432", centerX("Telf: 02-2345678 / 0998765432", 10), y, 10);
  y -= 14;
  draw("Quito - Ecuador", centerX("Quito - Ecuador", 10), y, 10);
  y -= 18;
  line(margin, y, pageW - margin, y, 2);
  y -= 24;

  // TÍTULO DOCUMENTO
  ensure(34);
  draw("NOTA DE ENTREGA", centerX("NOTA DE ENTREGA", 14, true), y, 14, true);
  y -= 26;

  // DATOS DEL COMPROBANTE
  const boxPad = 10;
  const infoRowH = 14;
  const infoRows = 5;
  const infoH = boxPad * 2 + infoRows * infoRowH;
  ensure(infoH + 10);
  rect(margin, y, contentW, infoH, 1.8);
  let yi = y - boxPad - 11;
  const labelX = margin + boxPad;
  const valueXRight = margin + contentW - boxPad;
  const drawInfo = (label: string, value: string, valueBold = false) => {
    draw(label, labelX, yi, 10, true);
    const v = value || "—";
    const vW = textW(v, 10, valueBold);
    draw(v, valueXRight - vW, yi, 10, valueBold);
    yi -= infoRowH;
  };
  drawInfo("Ticket No:", ticketNo, true);
  drawInfo("Fecha:", fecha);
  drawInfo("Hora:", hora);
  drawInfo("Atendido por:", atendidoPor);
  drawInfo("Forma de Pago:", formaPago, true);
  y -= infoH + 16;

  // DATOS DEL CLIENTE
  const clientRows = 3;
  const clientH = boxPad * 2 + clientRows * infoRowH;
  ensure(clientH + 10);
  rect(margin, y, contentW, clientH, 1.8);
  let yc = y - boxPad - 11;
  const drawClient = (label: string, value: string) => {
    const labelText = `${label}`;
    draw(labelText, labelX, yc, 10, true);
    const vx = labelX + 90;
    const lines = wrap(value || "—", 10, margin + contentW - boxPad - vx);
    draw(lines[0], vx, yc, 10, false);
    yc -= infoRowH;
  };
  drawClient("Nombre:", clienteNombre);
  drawClient("Dirección:", "—");
  drawClient("Cédula/RUC:", clienteCedula);
  y -= clientH + 18;

  // TABLA DE PRODUCTOS
  const tableHeaderH = 18;
  const colCant = 52;
  const colUnid = 52;
  const colValUnit = 90;
  const colValTot = 90;
  const colDesc = Math.max(120, contentW - colCant - colUnid - colValUnit - colValTot);
  const colXs = {
    cant: margin,
    unid: margin + colCant,
    desc: margin + colCant + colUnid,
    unit: margin + colCant + colUnid + colDesc,
    total: margin + colCant + colUnid + colDesc + colValUnit,
  };

  const drawTableHeader = () => {
    ensure(tableHeaderH + 6);
    line(margin, y, pageW - margin, y, 2);
    y -= 14;
    draw("CANT.", colXs.cant + 6, y, 9, true);
    draw("UNID.", colXs.unid + 6, y, 9, true);
    draw("DESCRIPCIÓN DE ARTÍCULO", colXs.desc + 6, y, 9, true);
    const vu = "VAL. UNIT.";
    draw(vu, colXs.unit + colValUnit - 6 - textW(vu, 9, true), y, 9, true);
    const vt = "VALOR T.";
    draw(vt, colXs.total + colValTot - 6 - textW(vt, 9, true), y, 9, true);
    y -= 10;
    line(margin, y, pageW - margin, y, 1.5);
    y -= 10;
  };

  drawTableHeader();

  const items = Array.isArray(sale.detalle_factura) ? sale.detalle_factura : [];
  for (const it of items) {
    const cantidad = String(Number(it.cantidad ?? 0));
    const unid = "UND";
    const nombre = String(it.producto?.nombre_producto ?? "—");
    const codigo = String(it.producto?.codigo_producto ?? "—");
    const unit = formatMoney(it.precio_unitario ?? 0);
    const tot = formatMoney(it.subtotal ?? 0);

    const descLines = wrap(nombre, 10, colDesc - 12);
    const codeLine = `Cód: ${codigo}`;
    const descBlockH = descLines.length * 12 + 10 + 6;
    const rowH = Math.max(26, descBlockH);

    ensure(rowH + 14);
    // Si cambiamos de página, repetir cabecera
    if (y === pageH - margin) {
      drawTableHeader();
    }

    const rowTopY = y;
    // Línea inferior por fila
    line(margin, rowTopY - rowH, pageW - margin, rowTopY - rowH, 0.8);

    const textY = rowTopY - 14;
    draw(cantidad, colXs.cant + 6, textY, 10, false);
    draw(unid, colXs.unid + 6, textY, 10, false);

    // descripción (1..n líneas) + código
    let dy = textY;
    for (const l of descLines) {
      draw(l, colXs.desc + 6, dy, 10, false);
      dy -= 12;
    }
    draw(codeLine, colXs.desc + 6, dy + 2, 9, false);

    const unitW = textW(unit, 10);
    draw(unit, colXs.unit + colValUnit - 6 - unitW, textY, 10, false);

    const totW = textW(tot, 10, true);
    draw(tot, colXs.total + colValTot - 6 - totW, textY, 10, true);

    y -= rowH + 8;
  }

  y -= 6;

  // TOTALES (caja a la derecha)
  const totalsW = 210;
  const totalsX = pageW - margin - totalsW;
  const totalsRows = 4;
  const totalsH = boxPad * 2 + totalsRows * infoRowH + 6;
  ensure(totalsH + 12);
  rect(totalsX, y, totalsW, totalsH, 1.8);

  let yt = y - boxPad - 11;
  const totalsLabelX = totalsX + boxPad;
  const totalsValueRight = totalsX + totalsW - boxPad;
  const drawTotalRow = (label: string, value: string, boldValue = false) => {
    draw(label, totalsLabelX, yt, 10, true);
    const vW = textW(value, 10, boldValue);
    draw(value, totalsValueRight - vW, yt, 10, boldValue);
    yt -= infoRowH;
  };
  drawTotalRow("SUBTOTAL:", formatMoney(subtotal15));
  drawTotalRow("IVA 0%:", formatMoney(subtotal0));
  drawTotalRow("IVA 15%:", formatMoney(iva15));

  // Separador y TOTAL
  line(totalsX, yt + 6, totalsX + totalsW, yt + 6, 2);
  yt -= 10;
  draw("TOTAL:", totalsLabelX, yt, 12, true);
  const totalText = formatMoney(total);
  draw(totalText, totalsValueRight - textW(totalText, 12, true), yt, 12, true);

  y -= totalsH + 24;

  // PIE DE PÁGINA: firmas + aviso
  const sigH = 70;
  ensure(sigH + 60);
  const halfW = (contentW - 40) / 2;
  const sigY = y - sigH;
  const sigLineY = sigY + 26;
  line(margin, sigLineY, margin + halfW, sigLineY, 1.5);
  line(margin + halfW + 40, sigLineY, margin + halfW + 40 + halfW, sigLineY, 1.5);
  draw("Firma Responsable", margin + (halfW - textW("Firma Responsable", 10, true)) / 2, sigLineY - 18, 10, true);
  draw(
    "Firma Cliente",
    margin + halfW + 40 + (halfW - textW("Firma Cliente", 10, true)) / 2,
    sigLineY - 18,
    10,
    true
  );
  y = sigY;

  const msg = "SALIDA LA MERCADERÍA NO SE ACEPTAN DEVOLUCIONES";
  const msgH = 34;
  rect(margin, y, contentW, msgH, 1.8);
  draw(msg, centerX(msg, 10, true), y - 22, 10, true);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
