import { jsonCors, optionsCors } from "../../../../../lib/cors";
import payphoneWebhook from "../../../../../lib/services/payphone.webhook";

export async function OPTIONS() {
  return optionsCors();
}

// POST /api/payments/payphone/webhook
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headers = Object.fromEntries((req.headers as Headers).entries()) as Record<string, string>;

    const result = await payphoneWebhook.handlePayphoneWebhook(rawBody, headers);

    // If ignored due to dedup, return 200 OK silently
    return jsonCors({ ok: true, result }, { status: 200 });
  } catch (err: unknown) {
    const e = err as { message?: string } | undefined;
    if (e && e.message === "INVALID_WEBHOOK_SIGNATURE") {
      return jsonCors({ error: "Firma inválida" }, { status: 401 });
    }
    if (e && e.message === "INVALID_PAYLOAD") {
      return jsonCors({ error: "Payload inválido" }, { status: 400 });
    }
    console.error("Error webhook Payphone:", err);
    return jsonCors({ error: "Error interno" }, { status: 500 });
  }
}
