import { randomUUID } from "crypto";
import prisma from "../prisma";

type CreatePaymentParams = {
  id_credito?: number;
  id_factura?: number;
  id_cuota?: number;
  amount: number | string;
  currency?: string;
  id_usuario?: number;
  metadata?: unknown;
  idempotencyKey?: string;
};

export async function createPayment(params: CreatePaymentParams) {
  const { id_credito, id_factura, id_cuota, amount, currency, id_usuario, metadata } = params;

  // Validar entrada: requerir id_credito o id_factura
  if (!id_credito && !id_factura) throw new Error("MISSING_TARGET: id_credito or id_factura is required");

  // Si viene id_credito, validar crédito
  if (id_credito) {
    const credito = await prisma.credito.findUnique({ where: { id_credito } });
    if (!credito) throw new Error("CREDITO_NO_ENCONTRADO");
    if (credito.estado_credito === "CANCELADO") throw new Error("CREDITO_CANCELADO");
  }

  // Si viene id_factura, validar factura
  if (id_factura) {
    const factura = await prisma.factura.findUnique({ where: { id_factura } });
    if (!factura) throw new Error("FACTURA_NO_ENCONTRADA");
  }

  // Si se proporcionó cuota, validar
  if (id_cuota) {
    const cuota = await prisma.cuota.findUnique({ where: { id_cuota } });
    if (!cuota) throw new Error("CUOTA_NO_ENCONTRADA");
    if (cuota.id_credito !== id_credito) throw new Error("CUOTA_NO_ENCONTRADA");
    if (cuota.estado_cuota === "PAGADO") throw new Error("CUOTA_YA_PAGADA");
    // Si la cuota está en un estado que no admite pago (negocio), lanzar error
    // Permitimos PENDIENTE, PARCIAL, VENCIDO
    if (!(cuota.estado_cuota === "PENDIENTE" || cuota.estado_cuota === "PARCIAL" || cuota.estado_cuota === "VENCIDO")) {
      throw new Error("CUOTA_NO_PAGABLE");
    }
  }

  // Generar provider_reference y idempotency_key
  const provider_reference = randomUUID();
  const idempotency_key = params.idempotencyKey ?? randomUUID();

  // Crear payment en estado PENDING
  const payment = await prisma.payment.create({
    data: {
      provider: "PAYPHONE",
      status: "PENDING",
      provider_reference,
      idempotency_key,
      amount: typeof amount === "string" ? amount : Number(amount),
      currency: currency ?? "USD",
      id_credito: id_credito ? Number(id_credito) : undefined,
      id_factura: id_factura ? Number(id_factura) : undefined,
      id_cuota: id_cuota ? Number(id_cuota) : undefined,
      id_usuario: id_usuario ? Number(id_usuario) : undefined,
      metadata: metadata ?? undefined,
    },
  });

  return {
    payment,
    provider_reference,
    idempotency_key,
  };
}

const paymentService = { createPayment };
export default paymentService;
