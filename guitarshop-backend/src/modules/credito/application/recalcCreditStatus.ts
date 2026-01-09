import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";

export type CreditStatus = "ACTIVO" | "EN_MORA" | "CANCELADO";
export type InstallmentStatus = "PENDIENTE" | "VENCIDA" | "PAGADA";

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isPaid(installment: { estado_cuota: string; fecha_pago: Date | null; monto_cuota: any; monto_pagado: any }): boolean {
  if (installment.fecha_pago) return true;
  if (installment.estado_cuota === "PAGADA") return true;
  const montoCuota = Number(installment.monto_cuota);
  const montoPagado = Number(installment.monto_pagado);
  return Number.isFinite(montoCuota) && Number.isFinite(montoPagado) && montoPagado >= montoCuota;
}

function computeInstallmentStatus(params: {
  dueDate: Date;
  paid: boolean;
  todayUtc: Date;
}): InstallmentStatus {
  if (params.paid) return "PAGADA";
  return dateOnlyUtc(params.dueDate).getTime() < params.todayUtc.getTime() ? "VENCIDA" : "PENDIENTE";
}

function computeCreditStatus(params: {
  saldoPendiente: number;
  hasOverdueUnpaid: boolean;
}): CreditStatus {
  if (params.saldoPendiente <= 0) return "CANCELADO";
  if (params.hasOverdueUnpaid) return "EN_MORA";
  return "ACTIVO";
}

export async function recalcCreditStatus(id_credito: number, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const todayUtc = dateOnlyUtc(new Date());

  const credito = await db.credito.findUnique({
    where: { id_credito },
    select: {
      id_credito: true,
      saldo_pendiente: true,
      estado_credito: true,
      fecha_fin: true,
      cuota: {
        select: {
          id_cuota: true,
          fecha_vencimiento: true,
          estado_cuota: true,
          fecha_pago: true,
          monto_cuota: true,
          monto_pagado: true,
        },
      },
    },
  });

  if (!credito) {
    throw new Error("CREDITO_NO_ENCONTRADO");
  }

  const updates: Array<Promise<unknown>> = [];

  let hasOverdueUnpaid = false;
  for (const cuota of credito.cuota) {
    const paid = isPaid(cuota);
    const newEstado = computeInstallmentStatus({
      dueDate: cuota.fecha_vencimiento,
      paid,
      todayUtc,
    });

    if (!paid && newEstado === "VENCIDA") {
      hasOverdueUnpaid = true;
    }

    if (cuota.estado_cuota !== newEstado) {
      updates.push(
        db.cuota.update({
          where: { id_cuota: cuota.id_cuota },
          data: { estado_cuota: newEstado },
          select: { id_cuota: true },
        })
      );
    }
  }

  const saldoPendiente = Number(credito.saldo_pendiente);
  const newCreditStatus = computeCreditStatus({
    saldoPendiente,
    hasOverdueUnpaid,
  });

  if (credito.estado_credito !== newCreditStatus || (newCreditStatus === "CANCELADO" && !credito.fecha_fin)) {
    updates.push(
      db.credito.update({
        where: { id_credito },
        data: {
          estado_credito: newCreditStatus,
          fecha_fin: newCreditStatus === "CANCELADO" ? (credito.fecha_fin ?? new Date()) : credito.fecha_fin,
        },
        select: { id_credito: true },
      })
    );
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  return {
    id_credito,
    estado_credito: newCreditStatus,
  };
}
