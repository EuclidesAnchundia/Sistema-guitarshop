import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import prisma from "../../../../src/shared/prisma/prismaClient";
import { recalcCreditStatus } from "../../../../lib/services/creditoService";
import { withErrorHandling } from "../../../../src/shared/http/routeHandler";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/credits/:id
export const GET = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const recalculo = await recalcCreditStatus(id);

  const credito = await prisma.credito.findUnique({
    where: { id_credito: id },
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
          total: true,
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

  return jsonCors(
    {
      id: credito.id_credito,
      saleId: credito.id_factura,
      saleCode: credito.factura.numero_factura,
      cliente: credito.factura.cliente,
      total: credito.monto_total,
      saldoPendiente: credito.saldo_pendiente,
      status: recalculo.estado_credito,
      installments: credito.cuota.map((c) => ({
        id: c.id_cuota,
        number: c.numero_cuota,
        dueDate: c.fecha_vencimiento,
        amount: c.monto_cuota,
        paidAmount: c.monto_pagado,
        status: c.estado_cuota,
        paidAt: c.fecha_pago,
      })),
    },
    { status: 200 }
  );
});
