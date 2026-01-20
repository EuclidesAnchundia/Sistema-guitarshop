import { jsonCors, optionsCors } from "../../../../../lib/cors";
import payphoneWebhook from "../../../../../lib/services/payphone.webhook";
import { captureException, captureMessage, initObservability } from "../../../../../lib/observability/sentry";

export async function OPTIONS() {
  return optionsCors();
}

// POST /api/payments/payphone/webhook
export async function POST(req: Request) {
  try {
    // ensure observability initialised asap
    void initObservability();

    const rawBody = await req.text();
    const headers = Object.fromEntries((req.headers as Headers).entries()) as Record<string, string>;

    const result = await payphoneWebhook.handlePayphoneWebhook(rawBody, headers);

    // If ignored due to dedup, return 200 OK silently
    return jsonCors({ ok: true, result }, { status: 200 });
  } catch (err: unknown) {
    const e = err as { message?: string } | undefined;
    if (e && e.message === "INVALID_WEBHOOK_SIGNATURE") {
      try { captureMessage("Invalid webhook signature", "warning") } catch {}
      return jsonCors({ error: "Firma inválida" }, { status: 401 });
    }
    if (e && e.message === "MISSING_WEBHOOK_SECRET") {
      try { captureMessage("Webhook secret missing", "error") } catch {}
      captureException(err)
      return jsonCors({ error: "Webhook secret no configurado" }, { status: 500 });
    }
    if (e && e.message === "INVALID_PAYLOAD") {
      try { captureMessage("Invalid webhook payload", "warning") } catch {}
      return jsonCors({ error: "Payload inválido" }, { status: 400 });
    }
    captureException(err)
    return jsonCors({ error: "Error interno" }, { status: 500 });
  }
}
