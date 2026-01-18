import prisma from "../../../shared/prisma/prismaClient";
import { exportKeyValueToPdf, exportTableToCsv, exportTableToPdf, exportTableToXlsx, makeExportFilename, type ExportScope, type ExportFormat, type TableColumn } from "../../../shared/export/tableExport";

export type ProveedorExportQuery = {
  format: ExportFormat;
  scope: ExportScope;
  ids?: number[];
};

type ProveedorRow = {
  id_proveedor: number;
  nombre_proveedor: string;
  ruc_cedula: string;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_registro: Date;
  id_estado: number;
};

const columns: TableColumn<ProveedorRow>[] = [
  { header: "ID", align: "right", widthWeight: 0.7, value: (r) => r.id_proveedor },
  { header: "Proveedor", widthWeight: 1.9, value: (r) => r.nombre_proveedor },
  { header: "RUC/Cédula", widthWeight: 1.3, value: (r) => r.ruc_cedula },
  { header: "Correo", widthWeight: 1.8, value: (r) => r.correo ?? "" },
  { header: "Teléfono", widthWeight: 1.1, value: (r) => r.telefono ?? "" },
];

async function resolveRows(query: ProveedorExportQuery): Promise<{ rows: ProveedorRow[]; scope: ExportScope }> {
  if (query.scope === "page" && Array.isArray(query.ids) && query.ids.length > 0) {
    const ids = query.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    const items = await prisma.proveedor.findMany({
      where: { id_proveedor: { in: ids } },
      select: {
        id_proveedor: true,
        nombre_proveedor: true,
        ruc_cedula: true,
        correo: true,
        telefono: true,
        direccion: true,
        fecha_registro: true,
        id_estado: true,
      },
    });
    const byId = new Map(items.map((i) => [i.id_proveedor, i]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as ProveedorRow[];
    return { rows: ordered, scope: "page" };
  }

  const items = await prisma.proveedor.findMany({
    select: {
      id_proveedor: true,
      nombre_proveedor: true,
      ruc_cedula: true,
      correo: true,
      telefono: true,
      direccion: true,
      fecha_registro: true,
      id_estado: true,
    },
    orderBy: { id_proveedor: "asc" },
  });

  return { rows: items, scope: query.scope === "all" ? "all" : "page" };
}

export async function exportProveedoresFile(query: ProveedorExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveRows(query);
  const filename = makeExportFilename("proveedores", scope, query.format);

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, columns);
    return { buffer, contentType: "text/csv; charset=utf-8", filename };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Proveedores", rows, columns });
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename };
  }

  const buffer = await exportTableToPdf({ title: scope === "all" ? "Proveedores (Todos)" : "Proveedores (Página actual)", rows, columns });
  return { buffer, contentType: "application/pdf", filename };
}

export async function exportSingleProveedorPdf(proveedorId: number): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(proveedorId);
  const proveedor = await prisma.proveedor.findUnique({
    where: { id_proveedor: id },
    select: {
      id_proveedor: true,
      nombre_proveedor: true,
      ruc_cedula: true,
      correo: true,
      telefono: true,
      direccion: true,
      fecha_registro: true,
      id_estado: true,
    },
  });

  if (!proveedor) throw new Error("NOT_FOUND");

  const buffer = await exportKeyValueToPdf({
    title: `Proveedor: ${proveedor.nombre_proveedor}`,
    rows: [
      { label: "ID", value: proveedor.id_proveedor },
      { label: "RUC/Cédula", value: proveedor.ruc_cedula },
      { label: "Correo", value: proveedor.correo ?? "—" },
      { label: "Teléfono", value: proveedor.telefono ?? "—" },
      { label: "Dirección", value: proveedor.direccion ?? "—" },
      { label: "Estado", value: proveedor.id_estado === 1 ? "ACTIVO" : `ID=${proveedor.id_estado}` },
      { label: "Registro", value: proveedor.fecha_registro },
    ],
  });

  return { buffer, filename: `proveedor_${proveedor.id_proveedor}.pdf` };
}
