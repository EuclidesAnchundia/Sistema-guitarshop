import { jsonCors, optionsCors } from "../../../../../lib/cors";
import { verifyToken } from "../../../../../lib/auth";
import prisma from "../../../../../src/shared/prisma/prismaClient";
import { registrarPagoCuota, type MetodoPagoCredito } from "../../../../../lib/services/cuotaService";
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

  const body = (await req.json().catch(() => null)) as
    | { amount?: number; paidAt?: string; metodo?: string; referencia?: string; nota?: string }
    | null;

  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota: id },
    select: { id_cuota: true, id_credito: true, monto_cuota: true, monto_pagado: true },
  });

  if (!cuota) {
    return jsonCors({ error: "Cuota no encontrada" }, { status: 404 });
  }

  const montoFallback = Number((Number(cuota.monto_cuota) - Number(cuota.monto_pagado)).toFixed(2));
  const monto = typeof body?.amount === "number" && Number.isFinite(body.amount) ? Number(body.amount) : montoFallback;
  const fecha = body?.paidAt ? new Date(body.paidAt) : new Date();

  const metodoRaw = typeof body?.metodo === "string" ? body.metodo.toUpperCase() : "";
  const metodo: MetodoPagoCredito = (metodoRaw === "TRANSFERENCIA" || metodoRaw === "TARJETA" ? metodoRaw : "EFECTIVO") as MetodoPagoCredito;

  const resultado = await registrarPagoCuota({
    id_credito: cuota.id_credito,
    id_cuota: cuota.id_cuota,
    monto,
    fecha,
    metodo,
    referencia: body?.referencia ?? null,
    nota: body?.nota ?? null,
    id_usuario: auth.userId,
  });

  // Obtener la cuota actualizada para devolverla al cliente
  const cuotaActualizada = await prisma.cuota.findUnique({
    where: { id_cuota: cuota.id_cuota },
    select: {
      id_cuota: true,
      id_credito: true,
      numero_cuota: true,
      monto_cuota: true,
      monto_pagado: true,
      estado_cuota: true,
      fecha_pago: true,
    },
  });

  return jsonCors(
    {
      message: "Cuota pagada correctamente",
      credit: {
        id: resultado.credit.id_credito,
        saldoPendiente: resultado.credit.saldo_pendiente,
        status: resultado.credit.estado_credito,
        fechaFin: resultado.credit.fecha_fin,
      },
      cuota: cuotaActualizada ?? null,
    },
    { status: 200 }
  );
});
