import { jsonCors, optionsCors } from "../../../../../lib/cors";
import { verifyToken } from "../../../../../lib/auth";
import { pagarCuotaCompleta } from "../../../../../lib/services/cuotaService";
import { withErrorHandling } from "../../../../../src/shared/http/routeHandler";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // .../installments/:id/pay
  const idString = parts[parts.length - 2];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// POST /api/installments/:id/pay
export const POST = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.userId) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const resultado = await pagarCuotaCompleta({
    id_cuota: id,
    id_usuario_modifi: auth.userId,
  });

  return jsonCors(
    {
      message: "Cuota pagada correctamente",
      installment: {
        id: resultado.cuota.id_cuota,
        number: resultado.cuota.numero_cuota,
        dueDate: resultado.cuota.fecha_vencimiento,
        amount: resultado.cuota.monto_cuota,
        paidAmount: resultado.cuota.monto_pagado,
        status: resultado.cuota.estado_cuota,
        paidAt: resultado.cuota.fecha_pago,
      },
      credit: {
        id: resultado.credito.id_credito,
        saldoPendiente: resultado.credito.saldo_pendiente,
        status: resultado.credito.estado_credito,
        fechaFin: resultado.credito.fecha_fin,
      },
    },
    { status: 200 }
  );
});
