import { jsonCors, optionsCors } from "../../../../lib/cors";
import { createPayment } from "../../../../lib/services/payment.service";
import payphoneService from "../../../../lib/services/payphone.service";

export async function OPTIONS() {
  return optionsCors();
}

// POST /api/payments/payphone
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonCors({ error: "Body inválido" }, { status: 400 });

    const { id_credito, id_cuota, amount, currency, id_usuario, metadata } = body as {
      id_credito?: number;
      id_cuota?: number | null;
      amount?: number | string;
      currency?: string | null;
      id_usuario?: number | null;
      metadata?: unknown;
    };

    if (!id_credito) return jsonCors({ error: "id_credito es requerido" }, { status: 400 });
    if (amount === undefined || amount === null) return jsonCors({ error: "amount es requerido" }, { status: 400 });

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return jsonCors({ error: "amount inválido" }, { status: 400 });
    }

    // Crear registro payment en estado PENDING
    const { payment, provider_reference, idempotency_key } = await createPayment({
      id_credito: Number(id_credito),
      id_cuota: id_cuota ? Number(id_cuota) : undefined,
      amount: parsedAmount,
      currency: currency ?? undefined,
      id_usuario: id_usuario ? Number(id_usuario) : undefined,
      metadata,
      idempotencyKey: undefined,
    });

    // Llamar a Payphone para crear la intención de pago, pasando amount como Number
    const intent = await payphoneService.createPayphonePaymentIntent({
      amount: Number(payment.amount),
      currency: payment.currency,
      reference: provider_reference,
      idempotencyKey: idempotency_key,
      clientTransactionId: provider_reference,
    });

    return jsonCors({ payment, intent }, { status: 201 });
  } catch (err) {
    console.error("Error POST /api/payments/payphone:", err);
    return jsonCors({ error: "Error interno" }, { status: 500 });
  }
}
