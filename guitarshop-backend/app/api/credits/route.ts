import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";
import prisma from "../../../src/shared/prisma/prismaClient";
import { recalcCreditStatus } from "../../../lib/services/creditoService";
import { withErrorHandling } from "../../../src/shared/http/routeHandler";

export async function OPTIONS() {
  return optionsCors();
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// GET /api/credits
export const GET = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  const creditos = await prisma.credito.findMany({
    orderBy: { id_credito: "desc" },
    select: {
      id_credito: true,
      saldo_pendiente: true,
      estado_credito: true,
      factura: {
        select: {
          id_factura: true,
          numero_factura: true,
          cliente: {
            select: {
              id_cliente: true,
              nombres: true,
              apellidos: true,
              cedula: true,
            },
          },
        },
      },
      cuota: {
        where: { fecha_pago: null },
        orderBy: { fecha_vencimiento: "asc" },
        take: 1,
        select: {
          id_cuota: true,
          numero_cuota: true,
          fecha_vencimiento: true,
          monto_cuota: true,
          monto_pagado: true,
          estado_cuota: true,
        },
      },
    },
  });

  const resultados = await Promise.all(
    creditos.map(async (c) => {
      const recalculo = await recalcCreditStatus(c.id_credito);
      const next = c.cuota[0] ?? null;

      const nextStatus = next
        ? dateOnlyUtc(next.fecha_vencimiento).getTime() < dateOnlyUtc(new Date()).getTime()
          ? "VENCIDA"
          : "PENDIENTE"
        : null;

      return {
        id: c.id_credito,
        sale: {
          id: c.factura.id_factura,
          code: c.factura.numero_factura,
        },
        saldoPendiente: c.saldo_pendiente,
        status: recalculo.estado_credito,
        cliente: c.factura.cliente,
        nextInstallment: next
          ? {
              id: next.id_cuota,
              number: next.numero_cuota,
              dueDate: next.fecha_vencimiento,
              amount: next.monto_cuota,
              status: nextStatus,
            }
          : null,
      };
    })
  );

  return jsonCors(resultados, { status: 200 });
});
