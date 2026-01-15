import prisma from "../../../shared/prisma/prismaClient";
import { obtenerCompraPorId } from "./compraService";
import { exportTableToCsv, exportTableToPdf, exportTableToXlsx, makeExportFilename, type ExportScope, type ExportFormat, type TableColumn } from "../../../shared/export/tableExport";

export type CompraExportQuery = {
  format: ExportFormat;
  scope: ExportScope;
  ids?: number[];
};

type CompraRow = {
  id_compra: number;
  fecha_compra: Date;
  proveedor: string;
  usuario: string;
  subtotal: number;
  impuesto: number;
  total: number;
  id_estado: number;
};

const columns: TableColumn<CompraRow>[] = [
  { header: "Compra", align: "right", widthWeight: 0.9, value: (r) => r.id_compra },
  { header: "Fecha", widthWeight: 1.3, value: (r) => r.fecha_compra?.toISOString?.() ?? r.fecha_compra },
  { header: "Proveedor", widthWeight: 1.8, value: (r) => r.proveedor },
  { header: "Usuario", widthWeight: 1.5, value: (r) => r.usuario },
  { header: "Subtotal", align: "right", widthWeight: 1.0, value: (r) => r.subtotal },
  { header: "Impuesto", align: "right", widthWeight: 1.0, value: (r) => r.impuesto },
  { header: "Total", align: "right", widthWeight: 1.0, value: (r) => r.total },
];

async function resolveRows(query: CompraExportQuery): Promise<{ rows: CompraRow[]; scope: ExportScope }> {
  const select = {
    id_compra: true,
    fecha_compra: true,
    subtotal: true,
    impuesto: true,
    total: true,
    id_estado: true,
    proveedor: { select: { nombre_proveedor: true } },
    usuario: { select: { nombre_completo: true } },
  } as const;

  if (query.scope === "page" && Array.isArray(query.ids) && query.ids.length > 0) {
    const ids = query.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    const items = await prisma.compra.findMany({
      where: { id_compra: { in: ids } },
      select,
    });
    const byId = new Map(items.map((i) => [i.id_compra, i]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c) => ({
        id_compra: c!.id_compra,
        fecha_compra: c!.fecha_compra,
        proveedor: c!.proveedor?.nombre_proveedor ?? "—",
        usuario: c!.usuario?.nombre_completo ?? "—",
        subtotal: Number(c!.subtotal ?? 0),
        impuesto: Number(c!.impuesto ?? 0),
        total: Number(c!.total ?? 0),
        id_estado: Number(c!.id_estado ?? 0),
      }));

    return { rows: ordered, scope: "page" };
  }

  const items = await prisma.compra.findMany({
    select,
    orderBy: { id_compra: "desc" },
  });

  const rows = items.map((c) => ({
    id_compra: c.id_compra,
    fecha_compra: c.fecha_compra,
    proveedor: c.proveedor?.nombre_proveedor ?? "—",
    usuario: c.usuario?.nombre_completo ?? "—",
    subtotal: Number(c.subtotal ?? 0),
    impuesto: Number(c.impuesto ?? 0),
    total: Number(c.total ?? 0),
    id_estado: Number(c.id_estado ?? 0),
  }));

  return { rows, scope: query.scope === "all" ? "all" : "page" };
}

export async function exportComprasFile(query: CompraExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveRows(query);
  const filename = makeExportFilename("compras", scope, query.format);

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, columns);
    return { buffer, contentType: "text/csv; charset=utf-8", filename };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Compras", rows, columns });
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename };
  }

  const buffer = await exportTableToPdf({ title: scope === "all" ? "Compras (Todas)" : "Compras (Página actual)", rows, columns });
  return { buffer, contentType: "application/pdf", filename };
}

type CompraItemRow = {
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
};

const itemColumns: TableColumn<CompraItemRow>[] = [
  { header: "Código", widthWeight: 1.0, value: (r) => r.codigo_producto },
  { header: "Producto", widthWeight: 2.4, value: (r) => r.nombre_producto },
  { header: "Cantidad", align: "right", widthWeight: 1.0, value: (r) => r.cantidad },
  { header: "Costo", align: "right", widthWeight: 1.0, value: (r) => r.costo_unitario },
  { header: "Subtotal", align: "right", widthWeight: 1.0, value: (r) => r.subtotal },
];

export async function exportSingleCompraPdf(compraId: number): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(compraId);
  const compra = await obtenerCompraPorId(id);
  if (!compra) throw new Error("NOT_FOUND");

  const proveedor = compra.proveedor?.nombre_proveedor ?? "—";
  const fecha = compra.fecha_compra ? new Date(compra.fecha_compra).toLocaleString("es-EC") : "—";
  const total = Number(compra.total ?? 0);

  const rows: CompraItemRow[] = (compra.producto_compra ?? []).map((it) => ({
    codigo_producto: it.producto?.codigo_producto ?? "—",
    nombre_producto: it.producto?.nombre_producto ?? "—",
    cantidad: Number(it.cantidad_compra ?? 0),
    costo_unitario: Number(it.costo_unitario ?? 0),
    subtotal: Number(it.subtotal ?? 0),
  }));

  const buffer = await exportTableToPdf({
    title: `Compra #${compra.id_compra}`,
    subtitle: `Proveedor: ${proveedor} · Fecha: ${fecha} · Total: ${total}`,
    rows,
    columns: itemColumns,
  });

  return { buffer, filename: `compra_${compra.id_compra}.pdf` };
}
