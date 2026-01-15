import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportScope = "page" | "all";

export type PdfAlign = "left" | "right";

export type TableColumn<Row> = {
  header: string;
  align?: PdfAlign;
  widthWeight?: number;
  value: (row: Row) => unknown;
};

const A4 = { width: 595.28, height: 841.89 };
const PDF_MARGIN = 48;

const escapeCsv = (value: unknown): string => {
  const raw = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[\r\n,\"]/g.test(raw);
  const escaped = raw.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export function makeExportFilename(base: string, scope: ExportScope, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  const scopeLabel = scope === "all" ? "todos" : "pagina";
  return `${base}_${scopeLabel}_${date}.${format}`;
}

export async function exportTableToCsv<Row>(rows: Row[], columns: TableColumn<Row>[]): Promise<Buffer> {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsv(toCellString(c.value(row)))).join(","));
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
  const worksheet = workbook.addWorksheet(params.sheetName);

  worksheet.columns = params.columns.map((c, idx) => ({
    header: c.header,
    key: String(idx),
    width: Math.max(12, Math.min(40, Math.round((c.widthWeight ?? 1) * 14))),
    style: {
      alignment: { horizontal: c.align === "right" ? "right" : "left" },
    },
  }));

  params.rows.forEach((row) => {
    worksheet.addRow(
      params.columns.reduce<Record<string, unknown>>((acc, col, idx) => {
        acc[String(idx)] = col.value(row);
        return acc;
      }, {})
    );
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

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
  drawText(ctx, subtitle, PDF_MARGIN, ctx.y, 10, false, rgb(0.4, 0.4, 0.4));
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
      color: rgb(0.89, 0.91, 0.94),
    });
    ctx.y -= 10;
  };

  drawHeader();

  for (const row of params.rows) {
    ensureSpace(ctx, rowHeight + 8);
    const y = ctx.y;

    for (let i = 0; i < params.columns.length; i += 1) {
      const col = params.columns[i];
      const x = xs[i];
      const w = widths[i];
      const raw = toCellString(col.value(row));
      const text = truncateToWidth(font, rowSize, raw, w);

      if (col.align === "right") {
        const tw = font.widthOfTextAtSize(text, rowSize);
        drawText(ctx, text, x + w - tw, y, rowSize);
      } else {
        drawText(ctx, text, x, y, rowSize);
      }
    }

    ctx.y -= rowHeight;

    if (ctx.y < PDF_MARGIN + 40) {
      ctx = newPage({ pdf, font, bold });
      drawHeader();
    }
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

  let ctx: PdfCtx = newPage({ pdf, font, bold });

  drawText(ctx, params.title, PDF_MARGIN, ctx.y, 18, true);
  ctx.y -= 24;

  const subtitle = params.subtitle ?? `Generado: ${new Date().toLocaleString("es-EC")}`;
  drawText(ctx, subtitle, PDF_MARGIN, ctx.y, 10, false, rgb(0.4, 0.4, 0.4));
  ctx.y -= 22;

  const labelW = 130;
  const gap = 10;
  const valueX = PDF_MARGIN + labelW + gap;
  const valueW = A4.width - PDF_MARGIN - valueX;

  for (const row of params.rows) {
    ensureSpace(ctx, 14);
    drawText(ctx, `${row.label}:`, PDF_MARGIN, ctx.y, 10, true);
    const value = truncateToWidth(font, 10, toCellString(row.value) || "—", valueW);
    drawText(ctx, value, valueX, ctx.y, 10, false);
    ctx.y -= 14;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
