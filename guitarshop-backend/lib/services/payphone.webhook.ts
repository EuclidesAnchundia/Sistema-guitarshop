import crypto from "crypto";
import prisma from "../prisma";
import { Prisma } from "../../generated/prisma/client";
import { applyConfirmedPayment } from "../../src/modules/cuota/application/cuotaService";

type HeadersLike = Record<string, string | null | undefined>;

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(rawBody: string, headers: HeadersLike) {
  const secret = process.env.PAYPHONE_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured → skip verification (unsafe for prod)

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
      return { ok: true, ignored: true };
    }
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
    // No payment associated — nothing more to do
    return { ok: true, message: "PAYMENT_NOT_FOUND" };
  }

  // If already CONFIRMED and incoming CONFIRMED, ignore
  if (payment.status === "CONFIRMED" && newStatus === "CONFIRMED") {
    return { ok: true, message: "ALREADY_CONFIRMED" };
  }

  if (newStatus === "CONFIRMED") {
    // Delegate the confirmed-payment handling to cuotaService to avoid duplication
    const result = await prisma.$transaction(async (tx) => {
      return await applyConfirmedPayment(
        tx as unknown as Parameters<typeof prisma.$transaction>[0] extends (arg: infer A) => unknown ? A : never,
        (payment as Record<string, unknown>)["id_payment"] as number,
        providerReference as string | undefined
      );
    });

    return result;
  }

  // Handle FAILED/REFUNDED/CANCELED: update payment timestamps/status
  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "FAILED") (update.failed_at = new Date());
  if (newStatus === "REFUNDED") (update.refunded_at = new Date());
  if (newStatus === "CANCELED") (update.failed_at = new Date());

  await prisma.payment.update({ where: { id_payment: (payment as Record<string, unknown>)["id_payment"] as number }, data: update as unknown as Prisma.paymentUpdateInput });

  return { ok: true, message: "UPDATED_STATUS" };
}

const payphoneWebhookService = { handlePayphoneWebhook };
export default payphoneWebhookService;
