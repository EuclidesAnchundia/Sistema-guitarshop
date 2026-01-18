import { jsonCors, optionsCors } from "../../../../../lib/cors";
import { verifyToken, hasAdminRole } from "../../../../../lib/auth";
import prisma from "../../../../../src/shared/prisma/prismaClient";
import { recalcCreditStatus } from "../../../../../lib/services/creditoService";
import { withErrorHandling } from "../../../../../src/shared/http/routeHandler";

export async function OPTIONS() {
  return optionsCors();
}

function getCreditoIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idx = parts.findIndex((p) => p === "creditos");
  if (idx < 0) return null;
  const idString = parts[idx + 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function computeInstallmentUiStatus(params: { dueDate: Date; saldo: number; paidAmount: number; amount: number }) {
  const paid = params.saldo <= 0.0001;
  if (paid) return { estado: "PAGADO" as const, dias: 0, parcial: false };

  const parcial = params.paidAmount > 0.0001 && params.saldo > 0.0001;
  const today = dateOnlyUtc(new Date()).getTime();
  const due = dateOnlyUtc(params.dueDate).getTime();
  const daysDiff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (due < today) {
    // Regla UX: si está vencida y saldo > 0 -> VENCIDO (rojo). Si tuvo abonos, se puede mostrar como info adicional.
    return { estado: "VENCIDO" as const, dias: Math.abs(daysDiff), parcial };
  }

  return { estado: parcial ? ("PARCIAL" as const) : ("PENDIENTE" as const), dias: Math.abs(daysDiff), parcial };
}

// GET /api/creditos/:creditoId/detalle
export const GET = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  // Permisos (hoy: admin). TODO: permitir CAJERO/COBRANZAS si aplica.
  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Acceso restringido" }, { status: 403 });
  }

  const creditoId = getCreditoIdFromUrl(req);
  if (!creditoId) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const recalculo = await recalcCreditStatus(creditoId);

  const credito = await prisma.credito.findUnique({
    where: { id_credito: creditoId },
    select: {
      id_credito: true,
      id_factura: true,
      monto_total: true,
      saldo_pendiente: true,
      estado_credito: true,
      fecha_inicio: true,
      fecha_fin: true,
      factura: {
        select: {
          id_factura: true,
          numero_factura: true,
          cliente: {
            select: { id_cliente: true, nombres: true, apellidos: true, cedula: true },
          },
        },
      },
      cuota: {
        orderBy: { numero_cuota: "asc" },
        select: {
          id_cuota: true,
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

  if (!credito) {
    return jsonCors({ error: "Crédito no encontrado" }, { status: 404 });
  }

  type MovimientoDb = {
    id_movimiento_credito: number;
    id_credito: number;
    id_cuota: number;
    fecha: Date;
    tipo: string;
    monto: unknown;
    metodo: string;
    referencia: string | null;
    nota: string | null;
    usuario: { id_usuario: number; nombre_completo: string; rol: string };
  };

  async function movimientoCreditoTableExists(): Promise<boolean> {
    try {
      const rows = await prisma.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public.movimiento_credito')::text AS name
      `;
      const name = rows?.[0]?.name ?? null;
      return Boolean(name);
    } catch {
      return false;
    }
  }

  // Movimientos: evitamos depender del modelo generado y también evitamos querys a una tabla que aún no existe.
  let movimientosDb: MovimientoDb[] = [];
  const hasMovTable = await movimientoCreditoTableExists();
  if (hasMovTable) {
    const movimientoModel = (prisma as unknown as Record<string, unknown>)["movimiento_credito"];
    if (movimientoModel && typeof (movimientoModel as { findMany?: unknown }).findMany === "function") {
      movimientosDb = (await (movimientoModel as { findMany: (...args: unknown[]) => Promise<unknown> }).findMany({
        where: { id_credito: creditoId },
        orderBy: { fecha: "desc" },
        select: {
          id_movimiento_credito: true,
          id_credito: true,
          id_cuota: true,
          fecha: true,
          tipo: true,
          monto: true,
          metodo: true,
          referencia: true,
          nota: true,
          usuario: { select: { id_usuario: true, nombre_completo: true, rol: true } },
        },
      })) as MovimientoDb[];
    } else {
      const rows = await prisma.$queryRaw<
        Array<{
          id_movimiento_credito: number;
          id_credito: number;
          id_cuota: number;
          fecha: Date;
          tipo: string;
          monto: unknown;
          metodo: string;
          referencia: string | null;
          nota: string | null;
          usuario_id_usuario: number;
          usuario_nombre_completo: string;
          usuario_rol: string;
        }>
      >`
        SELECT
          mc.id_movimiento_credito,
          mc.id_credito,
          mc.id_cuota,
          mc.fecha,
          mc.tipo,
          mc.monto,
          mc.metodo,
          mc.referencia,
          mc.nota,
          u.id_usuario AS usuario_id_usuario,
          u.nombre_completo AS usuario_nombre_completo,
          u.rol AS usuario_rol
        FROM movimiento_credito mc
        JOIN usuario u ON u.id_usuario = mc.id_usuario
        WHERE mc.id_credito = ${creditoId}
        ORDER BY mc.fecha DESC
      `;

      movimientosDb = rows.map((r) => ({
        id_movimiento_credito: r.id_movimiento_credito,
        id_credito: r.id_credito,
        id_cuota: r.id_cuota,
        fecha: r.fecha,
        tipo: r.tipo,
        monto: r.monto,
        metodo: r.metodo,
        referencia: r.referencia,
        nota: r.nota,
        usuario: {
          id_usuario: r.usuario_id_usuario,
          nombre_completo: r.usuario_nombre_completo,
          rol: r.usuario_rol,
        },
      }));
    }
  }

  const installments = credito.cuota.map((c) => {
    const amount = Number(c.monto_cuota);
    const paidAmount = Number(c.monto_pagado);
    const saldoPendiente = Number((amount - paidAmount).toFixed(2));
    const ui = computeInstallmentUiStatus({
      dueDate: c.fecha_vencimiento,
      saldo: saldoPendiente,
      paidAmount,
      amount,
    });

    return {
      id: c.id_cuota,
      numero: c.numero_cuota,
      fechaVencimiento: c.fecha_vencimiento,
      montoOriginal: c.monto_cuota,
      montoPagado: c.monto_pagado,
      saldoPendiente,
      estado: ui.estado,
      dias: ui.dias,
      parcial: ui.parcial,
      rawStatus: c.estado_cuota,
      paidAt: c.fecha_pago,
    };
  });

  return jsonCors(
    {
      credito: {
        id: credito.id_credito,
        saleId: credito.id_factura,
        saleCode: credito.factura.numero_factura,
        cliente: credito.factura.cliente,
        total: credito.monto_total,
        saldoPendiente: credito.saldo_pendiente,
        status: recalculo.estado_credito,
        fechaInicio: credito.fecha_inicio,
        fechaFin: credito.fecha_fin,
      },
      installments,
      movimientos: movimientosDb.map((m) => ({
        id: m.id_movimiento_credito,
        creditoId: m.id_credito,
        cuotaId: m.id_cuota,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        metodo: m.metodo,
        referencia: m.referencia,
        nota: m.nota,
        usuario: {
          id: m.usuario.id_usuario,
          nombre: m.usuario.nombre_completo,
          rol: m.usuario.rol,
        },
      })),
    },
    { status: 200 }
  );
});
