import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";

export type CreditStatus = "ACTIVO" | "EN_MORA" | "CANCELADO";
export type InstallmentStatus = "PENDIENTE" | "VENCIDA" | "PAGADA";

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type AmountLike = Prisma.Decimal | number | string | null | undefined;

function toNumberOrZero(value: AmountLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const maybeDecimal = value as unknown as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === "function") {
    const parsed = maybeDecimal.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPaid(installment: {
  estado_cuota: string;
  fecha_pago: Date | null;
  monto_cuota: AmountLike;
  monto_pagado: AmountLike;
}): boolean {
  if (installment.fecha_pago) return true;
  if (installment.estado_cuota === "PAGADA") return true;
  const montoCuota = toNumberOrZero(installment.monto_cuota);
  const montoPagado = toNumberOrZero(installment.monto_pagado);
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
