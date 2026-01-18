import prisma from "../../../shared/prisma/prismaClient";
import { recalcCreditStatus } from "./recalcCreditStatus";
import { exportTableToCsv, exportTableToPdf, exportTableToXlsx, exportSectionsToPdf, makeExportFilename, type ExportScope, type ExportFormat, type TableColumn } from "../../../shared/export/tableExport";

export type CreditsExportQuery = {
  format: ExportFormat;
  scope: ExportScope;
  ids?: number[];
};

type CreditRow = {
  id: number;
  saleCode: string;
  cliente: string;
  cedula: string;
  saldoPendiente: number;
  status: string;
};

const columns: TableColumn<CreditRow>[] = [
  { header: "Crédito", align: "right", widthWeight: 0.9, value: (r) => r.id },
  { header: "Factura", widthWeight: 1.1, value: (r) => r.saleCode },
  { header: "Cliente", widthWeight: 2.0, value: (r) => r.cliente },
  { header: "Cédula", widthWeight: 1.2, value: (r) => r.cedula },
  { header: "Saldo", align: "right", widthWeight: 1.0, value: (r) => r.saldoPendiente },
  { header: "Estado", widthWeight: 1.0, value: (r) => r.status },
];

async function fetchCreditsByIds(ids: number[]): Promise<CreditRow[]> {
  const items = await prisma.credito.findMany({
    where: { id_credito: { in: ids } },
    select: {
      id_credito: true,
      saldo_pendiente: true,
      estado_credito: true,
      factura: {
        select: {
          numero_factura: true,
          cliente: { select: { nombres: true, apellidos: true, cedula: true } },
        },
      },
    },
  });

  const byId = new Map(items.map((i) => [i.id_credito, i]));

  const ordered = [] as CreditRow[];
  for (const id of ids) {
    const it = byId.get(id);
    if (!it) continue;
    const recalculo = await recalcCreditStatus(it.id_credito);
    ordered.push({
      id: it.id_credito,
      saleCode: it.factura?.numero_factura ?? "—",
      cliente: it.factura?.cliente ? `${it.factura.cliente.nombres} ${it.factura.cliente.apellidos}` : "—",
      cedula: it.factura?.cliente?.cedula ?? "—",
      saldoPendiente: Number(it.saldo_pendiente ?? 0),
      status: recalculo.estado_credito ?? String(it.estado_credito ?? "ACTIVO"),
    });
  }
  return ordered;
}

async function resolveRows(query: CreditsExportQuery): Promise<{ rows: CreditRow[]; scope: ExportScope }> {
  if (query.scope === "page" && Array.isArray(query.ids) && query.ids.length > 0) {
    const ids = query.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    const rows = await fetchCreditsByIds(ids);
    return { rows, scope: "page" };
  }

  const items = await prisma.credito.findMany({
    orderBy: { id_credito: "desc" },
    select: {
      id_credito: true,
      saldo_pendiente: true,
      estado_credito: true,
      factura: {
        select: {
          numero_factura: true,
          cliente: { select: { nombres: true, apellidos: true, cedula: true } },
        },
      },
    },
  });

  const rows: CreditRow[] = [];
  for (const it of items) {
    const recalculo = await recalcCreditStatus(it.id_credito);
    rows.push({
      id: it.id_credito,
      saleCode: it.factura?.numero_factura ?? "—",
      cliente: it.factura?.cliente ? `${it.factura.cliente.nombres} ${it.factura.cliente.apellidos}` : "—",
      cedula: it.factura?.cliente?.cedula ?? "—",
      saldoPendiente: Number(it.saldo_pendiente ?? 0),
      status: recalculo.estado_credito ?? String(it.estado_credito ?? "ACTIVO"),
    });
  }

  return { rows, scope: query.scope === "all" ? "all" : "page" };
}

export async function exportCreditsFile(query: CreditsExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const { rows, scope } = await resolveRows(query);
  const filename = makeExportFilename("creditos", scope, query.format);

  if (query.format === "csv") {
    const buffer = await exportTableToCsv(rows, columns);
    return { buffer, contentType: "text/csv; charset=utf-8", filename };
  }

  if (query.format === "xlsx") {
    const buffer = await exportTableToXlsx({ sheetName: "Créditos", rows, columns });
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename };
  }

  const buffer = await exportTableToPdf({ title: scope === "all" ? "Créditos (Todos)" : "Créditos (Página actual)", rows, columns });
  return { buffer, contentType: "application/pdf", filename };
}

type InstallmentRow = {
  numero: number;
  vencimiento: string;
  monto: number;
  pagado: number;
  estado: string;
  fecha_pago: string;
};

const installmentColumns: TableColumn<InstallmentRow>[] = [
  { header: "Cuota", align: "right", widthWeight: 0.7, value: (r) => r.numero },
  { header: "Vence", widthWeight: 1.3, value: (r) => r.vencimiento },
  { header: "Monto", align: "right", widthWeight: 1.0, value: (r) => r.monto },
  { header: "Pagado", align: "right", widthWeight: 1.0, value: (r) => r.pagado },
  { header: "Estado", widthWeight: 1.0, value: (r) => r.estado },
  { header: "Pago", widthWeight: 1.2, value: (r) => r.fecha_pago },
];

export async function exportSingleCreditPdf(creditId: number): Promise<{ buffer: Buffer; filename: string }> {
  const id = Number(creditId);

  const recalculo = await recalcCreditStatus(id);

  const credito = await prisma.credito.findUnique({
    where: { id_credito: id },
    select: {
      id_credito: true,
      saldo_pendiente: true,
      monto_total: true,
      factura: {
        select: {
          numero_factura: true,
          cliente: { select: { nombres: true, apellidos: true, cedula: true } },
        },
      },
      cuota: {
        orderBy: { numero_cuota: "asc" },
        select: {
          numero_cuota: true,
          fecha_vencimiento: true,
          monto_cuota: true,
          monto_pagado: true,
          estado_cuota: true,
          fecha_pago: true,
        },
      },
    },
  });

  if (!credito) throw new Error("NOT_FOUND");

  const cliente = credito.factura?.cliente ? `${credito.factura.cliente.nombres} ${credito.factura.cliente.apellidos}` : "—";
  const saleCode = credito.factura?.numero_factura ?? "—";

  const rows: InstallmentRow[] = (credito.cuota ?? []).map((c) => ({
    numero: Number(c.numero_cuota ?? 0),
    vencimiento: c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString("es-EC") : "—",
    monto: Number(c.monto_cuota ?? 0),
    pagado: Number(c.monto_pagado ?? 0),
    estado: String(c.estado_cuota ?? ""),
    fecha_pago: c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString("es-EC") : "—",
  }));

  // Movimientos: evitamos consultar una tabla que aún no existe (migración pendiente).
  const hasMovTable = await (async () => {
    try {
      const rows = await prisma.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public.movimiento_credito')::text AS name
      `;
      const name = rows?.[0]?.name ?? null;
      return Boolean(name);
    } catch {
      return false;
    }
  })();

  const movimientoModel = (prisma as unknown as Record<string, unknown>)["movimiento_credito"];
  const movimientos = !hasMovTable
    ? ([] as Array<{
        fecha: Date;
        tipo: string;
        monto: unknown;
        metodo: string;
        referencia: string | null;
        nota: string | null;
        usuario: { nombre_completo: string };
      }>)
    : movimientoModel && typeof (movimientoModel as { findMany?: unknown }).findMany === "function"
      ? ((await (movimientoModel as { findMany: (...args: unknown[]) => Promise<unknown> }).findMany({
          where: { id_credito: id },
          orderBy: { fecha: "desc" },
          select: {
            fecha: true,
            tipo: true,
            monto: true,
            metodo: true,
            referencia: true,
            nota: true,
            usuario: { select: { nombre_completo: true } },
          },
        })) as Array<{
          fecha: Date;
          tipo: string;
          monto: unknown;
          metodo: string;
          referencia: string | null;
          nota: string | null;
          usuario: { nombre_completo: string };
        }>)
      : await (async () => {
          const rows = await prisma.$queryRaw<
            Array<{
              fecha: Date;
              tipo: string;
              monto: unknown;
              metodo: string;
              referencia: string | null;
              nota: string | null;
              usuario_nombre_completo: string;
            }>
          >`
            SELECT
              mc.fecha,
              mc.tipo,
              mc.monto,
              mc.metodo,
              mc.referencia,
              mc.nota,
              u.nombre_completo AS usuario_nombre_completo
            FROM movimiento_credito mc
            JOIN usuario u ON u.id_usuario = mc.id_usuario
            WHERE mc.id_credito = ${id}
            ORDER BY mc.fecha DESC
          `;

          return rows.map((r) => ({
            fecha: r.fecha,
            tipo: r.tipo,
            monto: r.monto,
            metodo: r.metodo,
            referencia: r.referencia,
            nota: r.nota,
            usuario: { nombre_completo: r.usuario_nombre_completo },
          }));
        })();

  type MovimientoRow = {
    fecha: string;
    tipo: string;
    monto: number;
    metodo: string;
    referencia: string;
    usuario: string;
  };

  const movimientoColumns: TableColumn<MovimientoRow>[] = [
    { header: "Fecha", widthWeight: 1.3, value: (r) => r.fecha, kind: "datetime" },
    { header: "Tipo", widthWeight: 0.9, value: (r) => r.tipo },
    { header: "Monto", align: "right", widthWeight: 0.9, value: (r) => r.monto, kind: "currency" },
    { header: "Método", widthWeight: 1.0, value: (r) => r.metodo },
    { header: "Ref/Nota", widthWeight: 1.8, value: (r) => r.referencia },
    { header: "Usuario", widthWeight: 1.3, value: (r) => r.usuario },
  ];

  const movimientoRows: MovimientoRow[] = movimientos.map((m) => ({
    fecha: m.fecha ? new Date(m.fecha).toLocaleString("es-EC") : "—",
    tipo: String(m.tipo ?? "PAGO"),
    monto: Number(m.monto ?? 0),
    metodo: String(m.metodo ?? ""),
    referencia: [m.referencia, m.nota].filter(Boolean).join(" · ") || "—",
    usuario: m.usuario?.nombre_completo ?? "—",
  }));

  const buffer = await exportSectionsToPdf({
    title: `Crédito #${credito.id_credito}`,
    subtitle: `Factura: ${saleCode} · Cliente: ${cliente} · Estado: ${recalculo.estado_credito} · Total: ${Number(credito.monto_total ?? 0)} · Saldo: ${Number(credito.saldo_pendiente ?? 0)}`,
    sections: [
      { title: "Cuotas", rows, columns: installmentColumns as unknown as import("../../../shared/export/tableExport").TableColumn<unknown>[] },
      { title: "Movimientos", rows: movimientoRows, columns: movimientoColumns as unknown as import("../../../shared/export/tableExport").TableColumn<unknown>[] },
    ],
  });

  return { buffer, filename: `credito_${credito.id_credito}.pdf` };
}
