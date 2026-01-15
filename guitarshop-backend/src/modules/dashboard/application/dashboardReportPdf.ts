import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";
import { obtenerDashboardExportBundle, type DashboardExportRange } from "./dashboardService";

const currencyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("es-EC", {
  maximumFractionDigits: 1,
  signDisplay: "always",
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatNumber = (value: number) => numberFormatter.format(value);
const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;

function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

export async function generateDashboardReportPdf(range: DashboardExportRange) {
  const bundle = await obtenerDashboardExportBundle(range);
  const { dashboard, primary, generatedAt } = bundle;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize = PageSizes.A4;
  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();

  const marginX = 46;
  const marginTop = 54;
  const marginBottom = 54;
  let cursorY = height - marginTop;

  const colorText = rgb(0.15, 0.17, 0.2);
  const colorMuted = rgb(0.45, 0.47, 0.52);
  const colorLine = rgb(0.86, 0.88, 0.9);

  const ensureSpace = (needed: number) => {
    if (cursorY - needed >= marginBottom) return;
    page = pdfDoc.addPage(pageSize);
    cursorY = height - marginTop;
  };

  const drawLine = () => {
    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: width - marginX, y: cursorY },
      thickness: 1,
      color: colorLine,
    });
    cursorY -= 12;
  };

  const drawText = (text: string, opts: { size: number; bold?: boolean; color?: ReturnType<typeof rgb> } ) => {
    const font = opts.bold ? fontBold : fontRegular;
    page.drawText(text, {
      x: marginX,
      y: cursorY,
      size: opts.size,
      font,
      color: opts.color ?? colorText,
    });
    cursorY -= opts.size + 6;
  };

  const drawKeyValueRow = (label: string, value: string) => {
    ensureSpace(22);
    page.drawText(label, { x: marginX, y: cursorY, size: 10, font: fontRegular, color: colorMuted });
    page.drawText(value, { x: width - marginX - 220, y: cursorY, size: 10, font: fontBold, color: colorText });
    cursorY -= 16;
  };

  // A) Encabezado
  ensureSpace(80);
  drawText("GuitarShop - Reporte de Dashboard", { size: 16, bold: true });
  drawText(`Generado: ${generatedAt.toLocaleString("es-EC")}`, { size: 10, color: colorMuted });
  drawText(`Rango: ${bundle.rangeLabel}`, { size: 10, color: colorMuted });
  drawLine();

  // B) Resumen principal
  ensureSpace(120);
  drawText("Resumen principal", { size: 13, bold: true });
  drawText(`Periodo: ${primary.periodLabel}`, { size: 10, color: colorMuted });

  drawText("Rendimiento comercial", { size: 11, bold: true });
  drawKeyValueRow("Ventas", formatCurrency(primary.sales.amount));
  drawKeyValueRow("Facturas", formatNumber(primary.sales.orders));
  drawKeyValueRow("Ticket promedio", formatCurrency(primary.sales.avgTicket));
  drawKeyValueRow("Variación", formatPercent(primary.sales.delta));
  drawLine();

  drawText("Ingresos vs utilidad", { size: 11, bold: true });
  drawKeyValueRow("Ingresos", formatCurrency(primary.revenue.ingresos));
  drawKeyValueRow("Utilidad", formatCurrency(primary.revenue.utilidad));
  drawKeyValueRow("Margen", `${(primary.revenue.margen * 100).toFixed(1)}%`);
  drawKeyValueRow("Variación", formatPercent(primary.revenue.delta));
  drawLine();

  // C) Alertas inmediatas
  ensureSpace(110);
  drawText("Alertas inmediatas", { size: 13, bold: true });
  drawKeyValueRow("Stock crítico (productos)", formatNumber(dashboard.alerts.stockCritico));
  drawKeyValueRow("Cuotas vencidas (conteo)", formatNumber(dashboard.alerts.cuotasVencidas));
  drawKeyValueRow("Monto vencido", formatCurrency(dashboard.credits.montoVencido));
  drawKeyValueRow("Créditos en riesgo", formatNumber(dashboard.credits.enRiesgo));
  drawLine();

  // D) Inventario
  ensureSpace(140);
  drawText("Inventario", { size: 13, bold: true });

  drawText("Top productos", { size: 11, bold: true });
  ensureSpace(18);
  page.drawText("Producto", { x: marginX, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Unid.", { x: width - marginX - 250, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Ingresos", { x: width - marginX - 180, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Stock", { x: width - marginX - 70, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  cursorY -= 14;

  const topProducts = dashboard.topProducts.slice(0, 4);
  if (topProducts.length === 0) {
    drawText("Sin datos para el periodo.", { size: 10, color: colorMuted });
  } else {
    for (const product of topProducts) {
      ensureSpace(18);
      page.drawText(truncate(product.nombre_producto, 36), { x: marginX, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatNumber(product.unidades_vendidas), { x: width - marginX - 250, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatCurrency(product.ingresos), { x: width - marginX - 180, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatNumber(product.stock_actual), { x: width - marginX - 70, y: cursorY, size: 10, font: fontRegular, color: colorText });
      cursorY -= 14;
    }
  }
  cursorY -= 6;

  drawText("Stock crítico", { size: 11, bold: true });
  ensureSpace(18);
  page.drawText("Producto", { x: marginX, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Stock", { x: width - marginX - 160, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Mínimo", { x: width - marginX - 70, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  cursorY -= 14;

  const lowStock = dashboard.lowStock.slice(0, 4);
  if (lowStock.length === 0) {
    drawText("Sin alertas de stock crítico.", { size: 10, color: colorMuted });
  } else {
    for (const item of lowStock) {
      ensureSpace(18);
      page.drawText(truncate(item.nombre_producto, 40), { x: marginX, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatNumber(item.cantidad_stock), { x: width - marginX - 160, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatNumber(item.stock_minimo), { x: width - marginX - 70, y: cursorY, size: 10, font: fontRegular, color: colorText });
      cursorY -= 14;
    }
  }
  drawLine();

  // E) Riesgo crediticio
  ensureSpace(160);
  drawText("Riesgo crediticio", { size: 13, bold: true });
  drawKeyValueRow("Créditos activos", formatNumber(dashboard.credits.activos));
  drawKeyValueRow("En riesgo", formatNumber(dashboard.credits.enRiesgo));
  drawKeyValueRow("Monto pendiente", formatCurrency(dashboard.credits.montoPendiente));
  drawKeyValueRow("Monto vencido", formatCurrency(dashboard.credits.montoVencido));

  drawText("Cuotas vencidas (detalle)", { size: 11, bold: true });
  ensureSpace(18);
  page.drawText("Cliente", { x: marginX, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Factura", { x: width - marginX - 260, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Pendiente", { x: width - marginX - 165, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  page.drawText("Días", { x: width - marginX - 70, y: cursorY, size: 10, font: fontBold, color: colorMuted });
  cursorY -= 14;

  if (!dashboard.credits.detalle || dashboard.credits.detalle.length === 0) {
    drawText("Sin cuotas vencidas para mostrar.", { size: 10, color: colorMuted });
  } else {
    for (const cuota of dashboard.credits.detalle) {
      ensureSpace(18);
      page.drawText(truncate(cuota.cliente, 26), { x: marginX, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(truncate(cuota.factura, 14), { x: width - marginX - 260, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatCurrency(cuota.montoPendiente), { x: width - marginX - 165, y: cursorY, size: 10, font: fontRegular, color: colorText });
      page.drawText(formatNumber(cuota.diasAtraso), { x: width - marginX - 70, y: cursorY, size: 10, font: fontRegular, color: colorText });
      cursorY -= 14;
    }
  }
  drawLine();

  // F) Operación
  ensureSpace(110);
  drawText("Operación", { size: 13, bold: true });
  drawKeyValueRow("Clientes", formatNumber(dashboard.summary.clientes));
  drawKeyValueRow("Productos", formatNumber(dashboard.summary.productos));
  drawKeyValueRow("Proveedores", formatNumber(dashboard.summary.proveedores));
  drawKeyValueRow("Compras", formatNumber(dashboard.summary.comprasRegistradas));

  const bytes = await pdfDoc.save();
  return bytes;
}
