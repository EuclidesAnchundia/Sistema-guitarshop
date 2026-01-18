import prisma from "../../../shared/prisma/prismaClient";
import { exportKeyValueToPdf, exportTableToCsv, exportTableToPdf, exportTableToXlsx, makeExportFilename, type ExportScope, type ExportFormat, type TableColumn } from "../../../shared/export/tableExport";

export type ClienteExportQuery = {
  format: ExportFormat;
  scope: ExportScope;
  ids?: number[];
};

type ClienteRow = {
  id_cliente: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_registro: Date;
  id_estado: number;
};

const columns: TableColumn<ClienteRow>[] = [
  { header: "ID", align: "right", widthWeight: 0.7, value: (r) => r.id_cliente },
  { header: "Nombres", widthWeight: 1.4, value: (r) => r.nombres },
  { header: "Apellidos", widthWeight: 1.4, value: (r) => r.apellidos },
  { header: "Cédula", widthWeight: 1.1, value: (r) => r.cedula },
  { header: "Correo", widthWeight: 1.8, value: (r) => r.correo ?? "" },
  { header: "Teléfono", widthWeight: 1.1, value: (r) => r.telefono ?? "" },
];

async function resolveRows(query: ClienteExportQuery): Promise<{ rows: ClienteRow[]; scope: ExportScope }> {
  if (query.scope === "page" && Array.isArray(query.ids) && query.ids.length > 0) {
    const ids = query.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    const items = await prisma.cliente.findMany({
      where: { id_cliente: { in: ids } },
      select: {
        id_cliente: true,
        nombres: true,
        apellidos: true,
        cedula: true,
        correo: true,
        telefono: true,
        direccion: true,
        fecha_registro: true,
        id_estado: true,
      },
    });
    const byId = new Map(items.map((i) => [i.id_cliente, i]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as ClienteRow[];
    return { rows: ordered, scope: "page" };
  }

  const items = await prisma.cliente.findMany({
    select: {
      id_cliente: true,
      nombres: true,
      apellidos: true,
      cedula: true,
      correo: true,
      telefono: true,
      direccion: true,
      fecha_registro: true,
      id_estado: true,
    },
    orderBy: { id_cliente: "asc" },
  });

  return { rows: items, scope: query.scope === "all" ? "all" : "page" };
}

export async function exportClientesFile(query: ClienteExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveRows(query);
  const filename = makeExportFilename("clientes", scope, query.format);

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, columns);
    return { buffer, contentType: "text/csv; charset=utf-8", filename };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Clientes", rows, columns });
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename };
  }

  const buffer = await exportTableToPdf({ title: scope === "all" ? "Clientes (Todos)" : "Clientes (Página actual)", rows, columns });
  return { buffer, contentType: "application/pdf", filename };
}

export async function exportSingleClientePdf(clienteId: number): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(clienteId);
  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: id },
    select: {
      id_cliente: true,
      nombres: true,
      apellidos: true,
      cedula: true,
      correo: true,
      telefono: true,
      direccion: true,
      fecha_registro: true,
      id_estado: true,
    },
  });

  if (!cliente) throw new Error("NOT_FOUND");

  const buffer = await exportKeyValueToPdf({
    title: `Cliente: ${cliente.nombres} ${cliente.apellidos}`,
    rows: [
      { label: "ID", value: cliente.id_cliente },
      { label: "Cédula", value: cliente.cedula },
      { label: "Correo", value: cliente.correo ?? "—" },
      { label: "Teléfono", value: cliente.telefono ?? "—" },
      { label: "Dirección", value: cliente.direccion ?? "—" },
      { label: "Estado", value: cliente.id_estado === 1 ? "ACTIVO" : `ID=${cliente.id_estado}` },
      { label: "Registro", value: cliente.fecha_registro },
    ],
  });

  return { buffer, filename: `cliente_${cliente.id_cliente}.pdf` };
}
