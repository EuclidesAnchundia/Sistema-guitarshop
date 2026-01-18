import { jsonCors, optionsCors } from "../../../../lib/cors";
import prisma from "../../../../lib/prisma";

export async function OPTIONS() {
  return optionsCors();
}

// POST /api/payments/create
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id_credito, id_cuota, amount, currency, provider_reference, idempotency_key, id_usuario } = body;

    if (!id_credito || !amount || !provider_reference) {
      return jsonCors({ error: "Campos requeridos: id_credito, amount, provider_reference" }, { status: 400 });
    }

    const payment = await prisma.payment.create({
      data: {
        provider_reference: String(provider_reference),
        idempotency_key: idempotency_key ? String(idempotency_key) : undefined,
        amount: amount,
        currency: currency ?? "USD",
        id_credito: Number(id_credito),
        id_cuota: id_cuota ? Number(id_cuota) : undefined,
        id_usuario: id_usuario ? Number(id_usuario) : undefined,
      },
    });

    return jsonCors({ payment }, { status: 201 });
  } catch (err) {
    console.error("Error POST /api/payments/create:", err);
    return jsonCors({ error: "Error interno" }, { status: 500 });
  }
}
