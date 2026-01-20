import prisma from "../../../shared/prisma/prismaClient";
import { recalcCreditStatus } from "../../credito/application/recalcCreditStatus";
import { Prisma } from "../../../../generated/prisma/client";

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (arg: infer A) => unknown ? A : never;

async function movimientoCreditoTableExists(tx: TxClient): Promise<boolean> {
  try {
    const txRunner = tx as unknown as {
      $queryRaw: <T = unknown>(query: TemplateStringsArray | string, ...args: unknown[]) => Promise<T>;
    };
    const rows = await txRunner.$queryRaw<Array<{ name: string | null }>>`
      SELECT to_regclass('public.movimiento_credito')::text AS name
    `;
    const name = rows?.[0]?.name ?? null;
    return Boolean(name);
  } catch {
    return false;
  }
}

async function createMovimientoCredito(
  tx: TxClient,
  args: {
    id_credito: number;
    id_cuota: number;
    fecha: Date;
    tipo: string;
    monto: number;
    metodo: string;
    referencia: string | null;
    nota: string | null;
    id_usuario: number;
  }
): Promise<{
  id_movimiento_credito: number;
  id_credito: number;
  id_cuota: number;
  fecha: Date;
  tipo: string;
  monto: unknown;
  metodo: string;
  referencia: string | null;
  nota: string | null;
  id_usuario: number;
}> {
  const hasTable = await movimientoCreditoTableExists(tx);
  if (!hasTable) {
    throw new Error("MOVIMIENTO_CREDITO_TABLE_MISSING");
  }

  const maybeModel = (tx as unknown as Record<string, unknown>)["movimiento_credito"];
  if (maybeModel && typeof (maybeModel as { create?: unknown }).create === "function") {
    const createFn = (maybeModel as { create: (...args: unknown[]) => Promise<unknown> }).create;
    const res = await createFn({
      data: {
        id_credito: args.id_credito,
        id_cuota: args.id_cuota,
        fecha: args.fecha,
        tipo: args.tipo,
        monto: args.monto,
        metodo: args.metodo,
        referencia: args.referencia,
        nota: args.nota,
        id_usuario: args.id_usuario,
      },
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
        id_usuario: true,
      },
    });
    return res as unknown as {
      id_movimiento_credito: number;
      id_credito: number;
      id_cuota: number;
      fecha: Date;
      tipo: string;
      monto: unknown;
      metodo: string;
      referencia: string | null;
      nota: string | null;
      id_usuario: number;
    };
  }

  // Fallback: el Prisma Client puede no incluir el modelo si no se ejecutó `prisma generate`.
  const txRunner = tx as unknown as {
    $queryRaw: <T = unknown>(query: TemplateStringsArray | string, ...args: unknown[]) => Promise<T>;
  };
  const rows = await txRunner.$queryRaw<
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
      id_usuario: number;
    }>
  >`
    INSERT INTO movimiento_credito (
      id_credito,
      id_cuota,
      fecha,
      tipo,
      monto,
      metodo,
      referencia,
      nota,
      id_usuario
    )
    VALUES (
      ${args.id_credito},
      ${args.id_cuota},
      ${args.fecha},
      ${args.tipo},
      ${args.monto},
      ${args.metodo},
      ${args.referencia},
      ${args.nota},
      ${args.id_usuario}
    )
    RETURNING
      id_movimiento_credito,
      id_credito,
      id_cuota,
      fecha,
      tipo,
      monto,
      metodo,
      referencia,
      nota,
      id_usuario
  `;

  return rows[0] as unknown as {
    id_movimiento_credito: number;
    id_credito: number;
    id_cuota: number;
    fecha: Date;
    tipo: string;
    monto: unknown;
    metodo: string;
    referencia: string | null;
    nota: string | null;
    id_usuario: number;
  };
}

function toDateOrThrow(value: unknown): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("FECHA_INVALIDA");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("FECHA_INVALIDA");
  }
  return parsed;
}

function toMetodoPagoOrThrow(value: unknown): MetodoPago {
  const raw = typeof value === "string" ? value.toUpperCase() : "";
  if (raw === "EFECTIVO" || raw === "TRANSFERENCIA" || raw === "TARJETA") return raw;
  throw new Error("METODO_PAGO_INVALIDO");
}

async function recalcularSaldoCredito(tx: Parameters<typeof prisma.$transaction>[0] extends (arg: infer A) => unknown ? A : never, id_credito: number) {
  const cuotas = await tx.cuota.findMany({
    where: { id_credito },
    select: { monto_cuota: true, monto_pagado: true },
  });

  const saldo = Number(
    cuotas
      .reduce((acc, c) => {
        const monto = Number(c.monto_cuota);
        const pagado = Number(c.monto_pagado);
        const restante = Math.max(monto - pagado, 0);
        return acc + restante;
      }, 0)
      .toFixed(2)
  );

  return saldo;
}

// ==========================
// OBTENER TODAS LAS CUOTAS
// ==========================
export async function obtenerTodasLasCuotas() {
  const cuotas = await prisma.cuota.findMany({
    select: cuotaSelect,
    orderBy: { id_cuota: "asc" },
  });

  return cuotas;
}

// Lo que devolvemos al frontend
const cuotaSelect = {
  id_cuota: true,
  id_credito: true,
  numero_cuota: true,
  fecha_vencimiento: true,
  monto_cuota: true,
  monto_pagado: true,
  estado_cuota: true,
  fecha_pago: true,
} as const;

// ==========================
// OBTENER CUOTA + CREDITO + FACTURA + CLIENTE
// ==========================
export async function obtenerCuotaDetallePorId(id_cuota: number) {
  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: {
      credito: {
        include: {
          factura: {
            include: {
              cliente: true,
            },
          },
        },
      },
    },
  });

  return cuota;
}

// ==========================
// PAGO DE CUOTA
// ==========================
// montoPago = cuánto está pagando el cliente en este momento
export async function pagarCuota(params: {
  id_cuota: number;
  montoPago: number;
  id_usuario_modifi: number;
}) {
  const { id_cuota, montoPago, id_usuario_modifi } = params;

  if (montoPago <= 0) {
    throw new Error("MONTO_INVALIDO");
  }

  // Traemos la cuota + el crédito relacionado
  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: {
      credito: true,
    },
  });

  if (!cuota) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  if (cuota.estado_cuota === "PAGADO") {
    throw new Error("CUOTA_YA_PAGADA");
  }

  const montoCuota = Number(cuota.monto_cuota);
  const montoPagadoActual = Number(cuota.monto_pagado);
  const saldoCuota = montoCuota - montoPagadoActual;

  if (montoPago > saldoCuota) {
    // no dejamos pagar más de lo que debe esa cuota
    throw new Error("MONTO_SUPERA_SALDO_CUOTA");
  }

  const nuevoMontoPagado = montoPagadoActual + montoPago;

  // Definimos estado de la cuota
  let nuevoEstado = "PENDIENTE";
  let fecha_pago: Date | null = null;

  if (nuevoMontoPagado === montoCuota) {
    nuevoEstado = "PAGADO";
    fecha_pago = new Date();
  } else if (nuevoMontoPagado > 0 && nuevoMontoPagado < montoCuota) {
    nuevoEstado = "PENDIENTE";
    // puedes decidir si guardar fecha_pago o no en parcial
    fecha_pago = null;
  }

  // Actualizamos dentro de una transacción: cuota + crédito
  const resultado = await prisma.$transaction(async (tx) => {
    // 1) Actualizar cuota
    const cuotaActualizada = await tx.cuota.update({
      where: { id_cuota },
      data: {
        monto_pagado: nuevoMontoPagado,
        estado_cuota: nuevoEstado as unknown as Prisma.cuotaUpdateInput["estado_cuota"],
        fecha_pago,
        id_usuario_modifi,
      },
      select: cuotaSelect,
    });

    // 2) Actualizar saldo del crédito
    const credito = await tx.credito.findUnique({
      where: { id_credito: cuota.id_credito },
    });

    if (!credito) {
      throw new Error("CREDITO_NO_ENCONTRADO");
    }

    const saldoActual = Number(credito.saldo_pendiente);
    const nuevoSaldo = saldoActual - montoPago;

    const creditoActualizado = await tx.credito.update({
      where: { id_credito: credito.id_credito },
      data: {
        saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
        // si ya no hay saldo, ponemos fecha_fin
        fecha_fin: nuevoSaldo <= 0 ? new Date() : credito.fecha_fin,
        id_usuario_modifi,
      },
    });

    await recalcCreditStatus(credito.id_credito, tx);

    return {
      cuota: cuotaActualizada,
      credito: {
        id_credito: creditoActualizado.id_credito,
        saldo_pendiente: creditoActualizado.saldo_pendiente,
        fecha_fin: creditoActualizado.fecha_fin,
      },
    };
  });

  return resultado;
}

// ==========================
// Reutilizable: aplicar pago confirmado
// - Ejecutar DENTRO de una transacción `tx`
// - Crea `movimiento_credito` (usa createMovimientoCredito interno)
// - Actualiza `payment` para vincular `id_movimiento_credito` y marcar CONFIRMED
// - Actualiza `cuota.monto_pagado` y `estado_cuota`
// - Decrementa `credito.saldo_pendiente`
// - Llama a `recalcCreditStatus` (importado desde creditoService)
// Retorna el objeto { movimientoId }
export async function applyConfirmedPayment(
  tx: TxClient,
  id_payment: number,
  providerReference?: string
) {
  // Obtener payment fresco dentro de la transacción
  const payment = await tx.payment.findUnique({ where: { id_payment } });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  if (payment.id_movimiento_credito) {
    return { ok: true, message: "MOVIMIENTO_EXISTENTE", movimientoId: payment.id_movimiento_credito };
  }

  if (!payment.id_credito) {
    throw new Error("PAYMENT_NO_CREDITO");
  }

  // Crear movimiento usando helper interno
  const movimiento = await createMovimientoCredito(tx, {
    id_credito: payment.id_credito,
    id_cuota: payment.id_cuota ?? 0,
    fecha: new Date(),
    tipo: "PAGO",
    monto: Number(payment.amount),
    metodo: "PAYPHONE",
    referencia: String(providerReference ?? payment.provider_reference),
    nota: "Pago confirmado vía pasarela",
    id_usuario: payment.id_usuario ?? 1,
  });

  // Vincular payment con movimiento y marcar confirmado
  await tx.payment.update({
    where: { id_payment: payment.id_payment },
    data: { status: "CONFIRMED", confirmed_at: new Date(), id_movimiento_credito: movimiento.id_movimiento_credito },
  });

  // Actualizar cuota si aplica
  if (payment.id_cuota) {
    const cuota = await tx.cuota.findUnique({ where: { id_cuota: payment.id_cuota } });
    if (!cuota) throw new Error("CUOTA_NO_ENCONTRADA");

    const montoPagadoPrev = Number(cuota.monto_pagado ?? 0);
    const montoCuota = Number(cuota.monto_cuota ?? 0);
    const nuevoMontoPagado = montoPagadoPrev + Number(payment.amount);

    await tx.cuota.update({
      where: { id_cuota: payment.id_cuota },
      data: {
        monto_pagado: nuevoMontoPagado,
        estado_cuota: nuevoMontoPagado >= montoCuota ? "PAGADO" : "PARCIAL",
        ...(nuevoMontoPagado >= montoCuota ? { fecha_pago: new Date() } : {}),
      },
    });
  }

  // Ajustar saldo pendiente del crédito
  const decrementObj = { decrement: Number(payment.amount) };
  await tx.credito.update({ where: { id_credito: payment.id_credito }, data: { saldo_pendiente: decrementObj as unknown as { decrement: number } } });

  // Recalcular estado del crédito
  await recalcCreditStatus(payment.id_credito, tx);

  return { ok: true, movimientoId: movimiento.id_movimiento_credito };
}

// ==========================
// REGISTRAR PAGO (con auditoría)
// ==========================
export type MetodoPagoCredito = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";

export async function registrarPagoCuota(params: {
  id_credito: number;
  id_cuota: number;
  monto: number;
  fecha: Date;
  metodo: MetodoPagoCredito;
  referencia?: string | null;
  nota?: string | null;
  id_usuario: number;
  pagarTodoCredito?: boolean;
}) {
  const {
    id_credito,
    id_cuota,
    monto,
    fecha,
    metodo,
    referencia,
    nota,
    id_usuario,
    pagarTodoCredito,
  } = params;

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("MONTO_INVALIDO");
  }

  if (metodo === "TRANSFERENCIA" && (!referencia || !String(referencia).trim())) {
    throw new Error("REFERENCIA_REQUERIDA");
  }

  const asDateOnly = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const resultado = await prisma.$transaction(async (tx) => {
    const credito = await tx.credito.findUnique({
      where: { id_credito },
      select: {
        id_credito: true,
        saldo_pendiente: true,
        estado_credito: true,
        fecha_fin: true,
        cuota: {
          orderBy: { numero_cuota: "asc" },
          select: {
            id_cuota: true,
            id_credito: true,
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

    if (!credito) throw new Error("CREDITO_NO_ENCONTRADO");
    if (credito.estado_credito === "CANCELADO" || Number(credito.saldo_pendiente) <= 0) {
      throw new Error("CREDITO_CANCELADO");
    }

    const cuotas = credito.cuota ?? [];
    const idx = cuotas.findIndex((c) => c.id_cuota === id_cuota);
    if (idx < 0) throw new Error("CUOTA_NO_ENCONTRADA");

    const cuotasPendientes = cuotas.filter((c) => {
      const montoCuota = Number(c.monto_cuota);
      const montoPagado = Number(c.monto_pagado);
      return montoCuota - montoPagado > 0.0001;
    });

    const saldoCredito = cuotasPendientes.reduce((acc, c) => acc + Math.max(Number(c.monto_cuota) - Number(c.monto_pagado), 0), 0);

    if (!pagarTodoCredito) {
      const cuota = cuotas[idx];
      const montoCuota = Number(cuota.monto_cuota);
      const montoPagado = Number(cuota.monto_pagado);
      const saldoCuota = Number((montoCuota - montoPagado).toFixed(2));

      if (saldoCuota <= 0.0001 || cuota.estado_cuota === "PAGADO") {
        throw new Error("CUOTA_YA_PAGADA");
      }

      if (monto > saldoCuota + 0.0001) {
        throw new Error("MONTO_SUPERA_SALDO_CUOTA");
      }

      const nuevoMontoPagado = Number((montoPagado + monto).toFixed(2));
      const nuevoSaldoCuota = Number((montoCuota - nuevoMontoPagado).toFixed(2));
      const pagada = nuevoSaldoCuota <= 0.0001;

      await tx.cuota.update({
        where: { id_cuota },
        data: {
          monto_pagado: nuevoMontoPagado,
          estado_cuota: pagada ? "PAGADO" : cuota.estado_cuota,
          fecha_pago: pagada ? asDateOnly(fecha) : null,
          id_usuario_modifi: id_usuario,
        },
        select: { id_cuota: true },
      });

      await createMovimientoCredito(tx, {
        id_credito,
        id_cuota,
        fecha,
        tipo: "PAGO",
        monto,
        metodo,
        referencia: referencia ?? null,
        nota: nota ?? null,
        id_usuario,
      });
    } else {
      // Pago total: distribuir el monto en cuotas pendientes (ordenadas) y generar un movimiento por cuota.
      if (monto > saldoCredito + 0.0001) {
        throw new Error("MONTO_SUPERA_SALDO_CREDITO");
      }

      let restante = Number(monto.toFixed(2));
      for (const cuota of cuotas) {
        if (restante <= 0.0001) break;
        const montoCuota = Number(cuota.monto_cuota);
        const montoPagado = Number(cuota.monto_pagado);
        const saldoCuota = Number((montoCuota - montoPagado).toFixed(2));
        if (saldoCuota <= 0.0001) continue;

        const pagoCuota = Math.min(restante, saldoCuota);
        const nuevoMontoPagado = Number((montoPagado + pagoCuota).toFixed(2));
        const nuevoSaldoCuota = Number((montoCuota - nuevoMontoPagado).toFixed(2));
        const pagada = nuevoSaldoCuota <= 0.0001;

        await tx.cuota.update({
          where: { id_cuota: cuota.id_cuota },
          data: {
              monto_pagado: nuevoMontoPagado,
              estado_cuota: (pagada ? ("PAGADO" as Prisma.cuotaUpdateInput["estado_cuota"]) : cuota.estado_cuota),
              fecha_pago: pagada ? asDateOnly(fecha) : null,
              id_usuario_modifi: id_usuario,
            },
          select: { id_cuota: true },
        });

        await createMovimientoCredito(tx, {
          id_credito,
          id_cuota: cuota.id_cuota,
          fecha,
          tipo: "PAGO",
          monto: pagoCuota,
          metodo,
          referencia: referencia ?? null,
          nota: (nota ? `${nota} · ` : "") + "Pago total del crédito",
          id_usuario,
        });

        restante = Number((restante - pagoCuota).toFixed(2));
      }

      if (restante > 0.01) {
        throw new Error("PAGO_INCONSISTENTE");
      }
    }

    // Recalcular saldo pendiente del crédito como suma de saldos de cuotas.
    const cuotasActualizadas = await tx.cuota.findMany({
      where: { id_credito },
      select: { monto_cuota: true, monto_pagado: true },
    });
    const nuevoSaldoCredito = Number(
      cuotasActualizadas
        .reduce((acc, c) => acc + Math.max(Number(c.monto_cuota) - Number(c.monto_pagado), 0), 0)
        .toFixed(2)
    );

    const creditoActualizado = await tx.credito.update({
      where: { id_credito },
      data: {
        saldo_pendiente: nuevoSaldoCredito <= 0 ? 0 : nuevoSaldoCredito,
        fecha_fin: nuevoSaldoCredito <= 0 ? (credito.fecha_fin ?? asDateOnly(fecha)) : null,
        id_usuario_modifi: id_usuario,
      },
      select: {
        id_credito: true,
        saldo_pendiente: true,
        estado_credito: true,
        fecha_fin: true,
      },
    });

    await recalcCreditStatus(id_credito, tx);
    const creditoRefrescado = await tx.credito.findUnique({
      where: { id_credito },
      select: { id_credito: true, saldo_pendiente: true, estado_credito: true, fecha_fin: true },
    });

    return {
      credit: creditoRefrescado ?? creditoActualizado,
    };
  });

  return resultado;
}

// ==========================
// REGISTRAR PAGO (PARCIAL/TOTAL) + MOVIMIENTO
// ==========================
export async function registrarPagoCuotaLegacy(params: {
  id_cuota: number;
  id_credito?: number;
  montoPago: number;
  fecha: string;
  metodo: MetodoPago;
  referencia?: string;
  nota?: string;
  id_usuario: number;
}) {
  const { id_cuota, id_credito, montoPago, fecha, metodo, referencia, nota, id_usuario } = params;

  if (montoPago <= 0) {
    throw new Error("MONTO_INVALIDO");
  }

  const paidAt = toDateOrThrow(fecha);

  const metodoNormalizado = toMetodoPagoOrThrow(metodo);
  if (metodoNormalizado === "TRANSFERENCIA" && (!referencia || referencia.trim().length === 0)) {
    throw new Error("REFERENCIA_REQUERIDA");
  }

  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: { credito: true },
  });

  if (!cuota) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  if (id_credito && cuota.id_credito !== id_credito) {
    throw new Error("CREDITO_NO_ENCONTRADO");
  }

  if (cuota.credito.estado_credito === "CANCELADO" || Number(cuota.credito.saldo_pendiente) <= 0) {
    throw new Error("CREDITO_CANCELADO");
  }

  const montoCuota = Number(cuota.monto_cuota);
  const montoPagadoActual = Number(cuota.monto_pagado);
  const saldoCuota = Number((montoCuota - montoPagadoActual).toFixed(2));

  if (saldoCuota <= 0 || cuota.estado_cuota === "PAGADO") {
    throw new Error("CUOTA_YA_PAGADA");
  }

  if (montoPago > saldoCuota) {
    throw new Error("MONTO_SUPERA_SALDO_CUOTA");
  }

  const nuevoMontoPagado = Number((montoPagadoActual + montoPago).toFixed(2));
  const cuotaPagada = nuevoMontoPagado >= montoCuota - 0.0001;

  const resultado = await prisma.$transaction(async (tx) => {
    const cuotaActualizada = await tx.cuota.update({
      where: { id_cuota },
      data: {
          monto_pagado: nuevoMontoPagado,
          estado_cuota: cuotaPagada ? ("PAGADO" as Prisma.cuotaUpdateInput["estado_cuota"]) : cuota.estado_cuota,
          fecha_pago: cuotaPagada ? paidAt : null,
          id_usuario_modifi: id_usuario,
        },
      select: cuotaSelect,
    });

    const movimiento = await createMovimientoCredito(tx, {
      id_credito: cuota.id_credito,
      id_cuota,
      fecha: paidAt,
      tipo: "PAGO",
      monto: montoPago,
      metodo: metodoNormalizado,
      referencia: referencia?.trim() ? referencia.trim() : null,
      nota: nota?.trim() ? nota.trim() : null,
      id_usuario,
    });

    const nuevoSaldoCredito = await recalcularSaldoCredito(tx, cuota.id_credito);

    await tx.credito.update({
      where: { id_credito: cuota.id_credito },
      data: {
        saldo_pendiente: nuevoSaldoCredito,
        fecha_fin: nuevoSaldoCredito <= 0 ? (cuota.credito.fecha_fin ?? paidAt) : null,
        id_usuario_modifi: id_usuario,
      },
      select: { id_credito: true },
    });

    const recalculo = await recalcCreditStatus(cuota.id_credito, tx);

    const creditoActualizado = await tx.credito.findUnique({
      where: { id_credito: cuota.id_credito },
      select: {
        id_credito: true,
        saldo_pendiente: true,
        estado_credito: true,
        fecha_fin: true,
      },
    });

    if (!creditoActualizado) {
      throw new Error("CREDITO_NO_ENCONTRADO");
    }

    return {
      cuota: cuotaActualizada,
      movimiento,
      credito: {
        ...creditoActualizado,
        estado_credito: recalculo.estado_credito,
      },
    };
  });

  return resultado;
}

// ==========================
// PAGO COMPLETO DE CUOTA (marcar como PAGADA)
// ==========================
export async function pagarCuotaCompleta(params: {
  id_cuota: number;
  id_usuario_modifi: number;
}) {
  const { id_cuota, id_usuario_modifi } = params;

  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: { credito: true },
  });

  if (!cuota) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  const montoCuota = Number(cuota.monto_cuota);
  const montoPagado = Number(cuota.monto_pagado);
  const restante = Number((montoCuota - montoPagado).toFixed(2));

  const yaPagada = cuota.estado_cuota === "PAGADO" || cuota.fecha_pago !== null || restante <= 0;
  if (yaPagada) {
    throw new Error("CUOTA_YA_PAGADA");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const cuotaActualizada = await tx.cuota.update({
      where: { id_cuota },
      data: {
        monto_pagado: cuota.monto_cuota,
        estado_cuota: "PAGADO",
        fecha_pago: new Date(),
        id_usuario_modifi,
      },
      select: cuotaSelect,
    });

    const credito = await tx.credito.findUnique({
      where: { id_credito: cuota.id_credito },
    });

    if (!credito) {
      throw new Error("CREDITO_NO_ENCONTRADO");
    }

    const saldoActual = Number(credito.saldo_pendiente);
    const nuevoSaldo = Number((saldoActual - restante).toFixed(2));

    await tx.credito.update({
      where: { id_credito: credito.id_credito },
      data: {
        saldo_pendiente: nuevoSaldo <= 0 ? 0 : nuevoSaldo,
        fecha_fin: nuevoSaldo <= 0 ? new Date() : credito.fecha_fin,
        id_usuario_modifi,
      },
      select: {
        id_credito: true,
        saldo_pendiente: true,
        fecha_fin: true,
        estado_credito: true,
      },
    });

    await recalcCreditStatus(credito.id_credito, tx);

    const creditoRefrescado = await tx.credito.findUnique({
      where: { id_credito: credito.id_credito },
      select: {
        id_credito: true,
        saldo_pendiente: true,
        fecha_fin: true,
        estado_credito: true,
      },
    });

    if (!creditoRefrescado) {
      throw new Error("CREDITO_NO_ENCONTRADO");
    }

    return {
      cuota: cuotaActualizada,
      credito: creditoRefrescado,
    };
  });

  return resultado;
}
