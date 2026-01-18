/**
 * Servicio Payphone — comunicación con la pasarela.
 * - Genera `clientTransactionId` propio (UUID)
 * - Envía intención de pago a la API de Payphone
 * - No confirma pagos ni toca la base de datos
 *
 * Config (via ENV):
 * - PAYPHONE_API_URL       (p.ej. https://api.payphone.com/v1/transactions)
 * - PAYPHONE_API_KEY       (clave privada para autenticación, si aplica)
 * - PAYPHONE_MERCHANT_ID   (opcional, si la API lo requiere)
 * - PAYPHONE_RETURN_URL    (URL de retorno para gebruiker)
 * - PAYPHONE_CALLBACK_URL  (webhook URL que Payphone debe llamar)
 */

import { randomUUID } from "crypto";

type CreateIntentParams = {
  amount: number | string; // en units monetarias (p.ej. 123.45)
  currency?: string;
  reference?: string; // referencia del negocio (p.ej. factura o crédito id)
  idempotencyKey?: string;
  clientTransactionId?: string; // si se quiere forzar el clientTransactionId
};

type CreateIntentResult = {
  clientTransactionId: string;
  paymentUrl?: string | null;
  paymentToken?: string | null;
  rawResponse: unknown;
};

const API_URL = process.env.PAYPHONE_API_URL;
const API_KEY = process.env.PAYPHONE_API_KEY;
const MERCHANT_ID = process.env.PAYPHONE_MERCHANT_ID;
const RETURN_URL = process.env.PAYPHONE_RETURN_URL;
const CALLBACK_URL = process.env.PAYPHONE_CALLBACK_URL;

export async function createPayphonePaymentIntent(
  params: CreateIntentParams
): Promise<CreateIntentResult> {
  if (!API_URL) throw new Error("PAYPHONE_API_URL no configurado");

  const clientTransactionId = params.clientTransactionId ?? randomUUID();

  const payload: Record<string, unknown> = {
    amount: typeof params.amount === "string" ? params.amount : Number(params.amount).toFixed(2),
    currency: params.currency ?? "USD",
    clientTransactionId,
    merchantId: MERCHANT_ID,
    reference: params.reference ?? null,
    returnUrl: RETURN_URL ?? undefined,
    callbackUrl: CALLBACK_URL ?? undefined,
  };

  // Clean undefined values
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey;

  const resp = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  if (!resp.ok) {
    const err = new Error(`Payphone API error: ${resp.status} ${resp.statusText}`);
    // attach response body for debugging without using `any`
    (err as unknown as Record<string, unknown>).response = json as unknown as Record<string, unknown> | null;
    throw err;
  }

  // Heurística para extraer URL/token: cada integración Payphone puede devolver campos distintos.
  const body = json as Record<string, unknown> | null;
  let paymentUrl: string | null = null;
  if (body) {
    if (typeof body.paymentUrl === "string") paymentUrl = body.paymentUrl;
    else if (typeof body.url === "string") paymentUrl = body.url;
    else if (typeof body.checkoutUrl === "string") paymentUrl = body.checkoutUrl;
    else if (body.data && typeof body.data === "object" && typeof (body.data as Record<string, unknown>).url === "string") paymentUrl = (body.data as Record<string, unknown>).url as string;
  }

  let paymentToken: string | null = null;
  if (body) {
    if (typeof body.paymentToken === "string") paymentToken = body.paymentToken;
    else if (typeof body.token === "string") paymentToken = body.token;
    else if (body.data && typeof body.data === "object" && typeof (body.data as Record<string, unknown>).token === "string") paymentToken = (body.data as Record<string, unknown>).token as string;
  }

  return {
    clientTransactionId,
    paymentUrl,
    paymentToken,
    rawResponse: json,
  };
}

const payphoneService = { createPayphonePaymentIntent };
export default payphoneService;
