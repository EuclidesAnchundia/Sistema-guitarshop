import { httpRequest } from "./httpClient"

export type PayphoneCreateIntentPayload = {
  id_credito?: number
  id_factura?: number
  id_cuota?: number | null
  amount: number
  currency?: string | null
  id_usuario?: number | null
  metadata?: unknown
}

export type PayphoneIntentResponse = {
  payment: {
    id_payment: number
    status: string
    amount: number
    currency: string
    provider_reference: string
  }
  intent: {
    id: string
    paymentUrl: string
    provider: string
  }
}

export const payphoneService = {
  async createIntent(payload: PayphoneCreateIntentPayload): Promise<PayphoneIntentResponse> {
    return httpRequest<PayphoneIntentResponse>("/payments/payphone", { method: "POST", body: payload })
  },
  async getPayment(id: number) {
    return httpRequest<{ payment: unknown }>(`/payments/${id}`)
  },
  async listByFactura(idFactura: number) {
    return httpRequest<{ payments: unknown[] }>(`/payments/by-factura/${idFactura}`)
  },
}

export default payphoneService
