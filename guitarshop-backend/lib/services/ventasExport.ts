import prisma from "../prisma";
import { exportSaleInvoiceToPdf, exportTableToCsv, exportTableToPdf, exportTableToXlsx, makeExportFilename, type ExportScope, type ExportFormat, type TableColumn } from "../../src/shared/export/tableExport";
import { obtenerVentaPorId } from "./facturaService";

export type VentasExportQuery = {
  format: ExportFormat;
  scope: ExportScope;
  ids?: number[];
};

type VentaRow = {
  id_factura: number;
  numero_factura: string;
  fecha_factura: Date;
  forma_pago: string;
  cliente: string;
  usuario: string;
  subtotal: number;
  impuesto: number;
  total: number;
  id_estado: number;
};

const columns: TableColumn<VentaRow>[] = [
  { header: "Factura", widthWeight: 1.0, value: (r) => r.numero_factura },
  { header: "Fecha", widthWeight: 1.2, value: (r) => r.fecha_factura },
  { header: "Cliente", widthWeight: 1.8, value: (r) => r.cliente },
  { header: "Forma pago", widthWeight: 1.0, value: (r) => r.forma_pago },
  { header: "Total", align: "right", widthWeight: 1.0, value: (r) => r.total },
];

async function resolveRows(query: VentasExportQuery): Promise<{ rows: VentaRow[]; scope: ExportScope }> {
  const select = {
    id_factura: true,
    numero_factura: true,
    fecha_factura: true,
    forma_pago: true,
    subtotal: true,
    impuesto: true,
    total: true,
    id_estado: true,
    cliente: { select: { nombres: true, apellidos: true, cedula: true } },
    usuario: { select: { nombre_completo: true } },
  } as const;

  if (query.scope === "page" && Array.isArray(query.ids) && query.ids.length > 0) {
    const ids = query.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    const items = await prisma.factura.findMany({ where: { id_factura: { in: ids } }, select });
    const byId = new Map(items.map((i) => [i.id_factura, i]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((f) => ({
        id_factura: f!.id_factura,
        numero_factura: f!.numero_factura,
        fecha_factura: f!.fecha_factura,
        forma_pago: String(f!.forma_pago ?? ""),
        cliente: f!.cliente ? `${f!.cliente.nombres} ${f!.cliente.apellidos}` : "—",
        usuario: f!.usuario?.nombre_completo ?? "—",
        subtotal: Number(f!.subtotal ?? 0),
        impuesto: Number(f!.impuesto ?? 0),
        total: Number(f!.total ?? 0),
        id_estado: Number(f!.id_estado ?? 0),
      }));
    return { rows: ordered, scope: "page" };
  }

  const items = await prisma.factura.findMany({ select, orderBy: { id_factura: "desc" } });
  const rows = items.map((f) => ({
    id_factura: f.id_factura,
    numero_factura: f.numero_factura,
    fecha_factura: f.fecha_factura,
    forma_pago: String(f.forma_pago ?? ""),
    cliente: f.cliente ? `${f.cliente.nombres} ${f.cliente.apellidos}` : "—",
    usuario: f.usuario?.nombre_completo ?? "—",
    subtotal: Number(f.subtotal ?? 0),
    impuesto: Number(f.impuesto ?? 0),
    total: Number(f.total ?? 0),
    id_estado: Number(f.id_estado ?? 0),
  }));

  return { rows, scope: query.scope === "all" ? "all" : "page" };
}

export async function exportVentasFile(query: VentasExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveRows(query);
  const filename = makeExportFilename("ventas", scope, query.format);

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, columns);
    return { buffer, contentType: "text/csv; charset=utf-8", filename };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Ventas", rows, columns });
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename };
  }

  const buffer = await exportTableToPdf({ title: scope === "all" ? "Ventas (Todas)" : "Ventas (Página actual)", rows, columns });
  return { buffer, contentType: "application/pdf", filename };
}

export async function exportSingleVentaPdf(ventaId: number): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(ventaId);
  const venta = await obtenerVentaPorId(id);
  if (!venta) throw new Error("NOT_FOUND");

  const buffer = await exportSaleInvoiceToPdf({
    sale: {
      numero_factura: venta.numero_factura,
      fecha_factura: venta.fecha_factura,
      forma_pago: venta.forma_pago,
      subtotal: Number(venta.subtotal ?? 0),
      impuesto: Number(venta.impuesto ?? 0),
      total: Number(venta.total ?? 0),
      cliente: venta.cliente,
      usuario: venta.usuario,
      detalle_factura: (venta.detalle_factura ?? []).map((d) => ({
        id_detalle_factura: d.id_detalle_factura,
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario ?? 0),
        descuento: Number(d.descuento ?? 0),
        subtotal: Number(d.subtotal ?? 0),
        producto: d.producto,
      })),
    },
  });

  return { buffer, filename: `venta_${venta.numero_factura}.pdf` };
}
