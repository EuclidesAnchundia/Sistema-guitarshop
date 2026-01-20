import crypto from "crypto";
import prisma from "../prisma";
import { Prisma } from "../../generated/prisma/client";
import { applyConfirmedPayment } from "../../src/modules/cuota/application/cuotaService";
import { initObservability, captureException, captureMessage } from "../observability/sentry";
import webhookRetry from "./webhookRetry";

type HeadersLike = Record<string, string | null | undefined>;

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifySignature(rawBody: string, headers: HeadersLike) {
  const secret = process.env.PAYPHONE_WEBHOOK_SECRET;
  if (!secret) {
    // In production we require a webhook secret; in non-prod we allow it but warn.
    if (process.env.NODE_ENV === "production") {
      throw new Error("MISSING_WEBHOOK_SECRET");
    }
    console.warn("PAYPHONE_WEBHOOK_SECRET not configured — skipping signature verification (non-prod)");
    return true;
  }

  const sigHeader = (headers["x-payphone-signature"] || headers["x-signature"] || "") as string;
  if (!sigHeader) throw new Error("INVALID_WEBHOOK_SIGNATURE");

  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(sigHeader, "hex");
  if (!timingSafeEqual(computed, provided)) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  return true;
}

export async function handlePayphoneWebhook(rawBody: string, headers: HeadersLike) {
  // Verify signature (throws on invalid)
  verifySignature(rawBody, headers);

  // Initialize observability (optional Sentry)
  void initObservability();

  // Basic structured log for observability
  try {
    const short = rawBody?.slice?.(0, 1024) ?? "";
    console.info("Payphone webhook received", { len: rawBody?.length ?? 0, snippet: short });
    try { captureMessage("Payphone webhook received", "info") } catch {}
  } catch {}

  // Parse body
  let body: Record<string, unknown> | null = null;
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    throw new Error("INVALID_PAYLOAD");
  }

  // Extract event id (flexible)
  const eventId = (() => {
    if (!body) return undefined;
    const b = body as Record<string, unknown>;
    if (b["id"]) return b["id"];
    if (b["event_id"]) return b["event_id"];
    const ev = b["event"] as Record<string, unknown> | undefined;
    if (ev && ev["id"]) return ev["id"];
    const data = b["data"] as Record<string, unknown> | undefined;
    if (data && data["id"]) return data["id"];
    if (data && data["transactionId"]) return data["transactionId"];
    return undefined;
  })();
  if (!eventId) throw new Error("MISSING_EVENT_ID");

  // Try to insert webhook event for idempotency
  try {
    await prisma.payment_webhook_event.create({ data: { event_id: String(eventId), payload: body as unknown as Prisma.InputJsonValue } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Already processed — ignore silently
      console.info("Payphone webhook ignored (duplicate)", { eventId: String(eventId) });
      try { captureMessage(`Webhook duplicate: ${String(eventId)}`, "info") } catch {}
      return { ok: true, ignored: true };
    }
    captureException(err)
    throw err;
  }

  // Extract provider reference and status
  const data = (() => {
    if (!body) return null;
    const b = body as Record<string, unknown>;
    const d = b["data"] as Record<string, unknown> | undefined;
    return (d ?? b) as Record<string, unknown> | null;
  })();

  const providerReference = (() => {
    if (!data) return undefined;
    if (data["clientTransactionId"]) return data["clientTransactionId"];
    if (data["reference"]) return data["reference"];
    if (data["transactionId"]) return data["transactionId"];
    if (data["provider_reference"]) return data["provider_reference"];
    return undefined;
  })();

  const providerReferenceStr = providerReference ? String(providerReference) : undefined;

  const incomingStatusRaw = String((data && (data["status"] ?? data["state"])) ?? (body && (body as Record<string, unknown>)["status"]) ?? "").toUpperCase();

  const mapStatus = (s: string) => {
    if (!s) return "PENDING";
    if (s.includes("CONFIR")) return "CONFIRMED";
    if (s.includes("FAILED") || s.includes("ERROR")) return "FAILED";
    if (s.includes("REFUND") || s.includes("REFUNDED")) return "REFUNDED";
    if (s.includes("CANCEL")) return "CANCELED";
    if (s.includes("PEND")) return "PENDING";
    return "PENDING";
  };

  const newStatus = mapStatus(incomingStatusRaw) as
    | "PENDING"
    | "CONFIRMED"
    | "FAILED"
    | "REFUNDED"
    | "CANCELED";

  // Find payment by provider_reference
  let payment: Record<string, unknown> | null = null;
  if (providerReference) {
    payment = await prisma.payment.findUnique({ where: { provider_reference: String(providerReference) } });
  }

  if (!payment) {
    // No payment associated — log and finish successfully (provider may send other events)
    console.warn("Payphone webhook: payment not found for providerReference", { providerReference: providerReferenceStr, eventId: String(eventId) });
    try { captureMessage(`Payment not found for providerReference=${providerReferenceStr} event=${String(eventId)}`, "warning") } catch {}
    return { ok: true, message: "PAYMENT_NOT_FOUND" };
  }

  // If already CONFIRMED and incoming CONFIRMED, ignore
  if (payment.status === "CONFIRMED" && newStatus === "CONFIRMED") {
    return { ok: true, message: "ALREADY_CONFIRMED" };
  }

  if (newStatus === "CONFIRMED") {
    // Si el payment está vinculado a un crédito, delegamos al handler existente
      if ((payment as Record<string, unknown>)["id_credito"]) {
      const result = await prisma.$transaction(async (tx) => {
        return await applyConfirmedPayment(
          tx as unknown as Parameters<typeof prisma.$transaction>[0] extends (arg: infer A) => unknown ? A : never,
          (payment as Record<string, unknown>)["id_payment"] as number,
          providerReferenceStr as string | undefined
        );
      });
      try { captureMessage(`Applied confirmed payment for credit ${String((payment as Record<string, unknown>)['id_credito'])}`, "info") } catch {}
      return result;
    }

    // Si está vinculado a una factura (CONTADO), marcar payment como CONFIRMED.
    if ((payment as Record<string, unknown>)["id_factura"]) {
      const idFactura = (payment as Record<string, unknown>)["id_factura"] as number;
      const idPayment = (payment as Record<string, unknown>)["id_payment"] as number;

      const result = await prisma.$transaction(async (tx) => {
        // 1) crear movimiento_factura
        await tx.movimiento_factura.create({
          data: {
            id_factura: idFactura,
            monto: Number((payment as Record<string, unknown>)["amount"] ?? 0),
            metodo: "PAYPHONE",
            referencia: providerReferenceStr ?? null,
            nota: "Pago confirmado vía pasarela",
            id_usuario: (payment as Record<string, unknown>)["id_usuario"] ? Number((payment as Record<string, unknown>)["id_usuario"]) : 1,
          },
        });

        // 2) marcar payment como CONFIRMED
        await tx.payment.update({
          where: { id_payment: idPayment },
          data: { status: "CONFIRMED", confirmed_at: new Date() },
        });

        // 3) Registrar total de pagos en movimiento_factura y marcar factura PAGADO si corresponde
        // Obtener suma de movimientos para la factura
        const sumRes = await tx.movimiento_factura.aggregate({
          where: { id_factura: idFactura },
          _sum: { monto: true },
        });
        const totalPagos = Number(sumRes._sum.monto ?? 0);

        // Obtener total de la factura
        const facturaRec = await tx.factura.findUnique({ where: { id_factura: idFactura }, select: { total: true } });
        const facturaTotal = Number(facturaRec?.total ?? 0);

        // Upsert estado 'PAGADO' en estado_registro si no existe
        const estadoPagado = await tx.estado_registro.upsert({
          where: { nombre_estado: "PAGADO" },
          update: { descripcion: "Factura pagada" },
          create: { nombre_estado: "PAGADO", descripcion: "Factura pagada" },
          select: { id_estado: true },
        });

        // Si los pagos cubren o exceden el total, marcar la factura como PAGADO
        if (totalPagos >= facturaTotal && facturaTotal > 0) {
          await tx.factura.update({ where: { id_factura: idFactura }, data: { id_estado: estadoPagado.id_estado } });
        }

        return { ok: true, message: "INVOICE_PAYMENT_CONFIRMED" };
      });

      return result;
    }

    // Si no está vinculado ni a crédito ni a factura, simplemente marcar confirmado
    try {
      await prisma.payment.update({
        where: { id_payment: (payment as Record<string, unknown>)["id_payment"] as number },
        data: { status: "CONFIRMED", confirmed_at: new Date() },
      });
      try { captureMessage(`Payment ${String((payment as Record<string, unknown>)['id_payment'])} confirmed`, "info") } catch {}
    } catch (err) {
      captureException(err)
      throw err
    }

    return { ok: true, message: "CONFIRMED" };
  }

  // Handle FAILED/REFUNDED/CANCELED: update payment timestamps/status
  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "FAILED") (update.failed_at = new Date());
  if (newStatus === "REFUNDED") (update.refunded_at = new Date());
  if (newStatus === "CANCELED") (update.failed_at = new Date());

  try {
    await prisma.payment.update({ where: { id_payment: (payment as Record<string, unknown>)["id_payment"] as number }, data: update as unknown as Prisma.paymentUpdateInput });
    try { captureMessage(`Payment ${String((payment as Record<string, unknown>)['id_payment'])} status updated to ${newStatus}`, "info") } catch {}
  } catch (err) {
    // On unexpected processing errors, capture and enqueue for retry
    captureException(err)
    try {
      const eventKey = String(eventId ?? Date.now())
      webhookRetry.enqueueWebhookRetry(eventKey, rawBody, headers as Record<string, string>)
      captureMessage(`Enqueued webhook retry event=${eventKey}`, "info")
    } catch (e) {
      captureException(e)
    }
    throw err
  }

  return { ok: true, message: "UPDATED_STATUS" };
}

const payphoneWebhookService = { handlePayphoneWebhook };
export default payphoneWebhookService;
