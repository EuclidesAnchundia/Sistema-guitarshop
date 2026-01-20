import { describe, it, expect, vi, beforeEach } from "vitest"

// Mocks of prisma used by the webhook handler
vi.mock("../lib/prisma", async () => {
  const actual = await vi.importActual<typeof import("../lib/prisma")>("../lib/prisma")
  return {
    __esModule: true,
    default: actual.default,
    prisma: actual.prisma,
  }
})

import prismaImport from "../lib/prisma"
import { handlePayphoneWebhook } from "../lib/services/payphone.webhook"

describe("payphone webhook integration (mocked prisma)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("creates movimiento_factura and marks factura PAGADO when payments cover total", async () => {
    // Prepare webhook body and signature headers (signature verification is tested elsewhere)
    const rawBody = JSON.stringify({ id: "evt_1", data: { clientTransactionId: "tx_1", status: "CONFIRMED" } })
    const headers = { "x-payphone-signature": "" }

    // Mock payment_webhook_event.create to succeed
    const pweCreate = vi.fn().mockResolvedValue({})
    // Mock payment.findUnique to return a payment linked to factura
    const paymentRecord = {
      id_payment: 10,
      provider_reference: "tx_1",
      status: "PENDING",
      amount: 100,
      id_factura: 5,
      id_usuario: 2,
    }
    const paymentFind = vi.fn().mockResolvedValue(paymentRecord)

    // Mock transaction: receive callback and run it with tx mock
    const movimientoCreate = vi.fn().mockResolvedValue({ id_movimiento_factura: 7 })
    const paymentUpdate = vi.fn().mockResolvedValue({})
    const movimientoAggregate = vi.fn().mockResolvedValue({ _sum: { monto: 100 } })
    const facturaFind = vi.fn().mockResolvedValue({ total: 100 })
    const estadoUpsert = vi.fn().mockResolvedValue({ id_estado: 3 })
    const facturaUpdate = vi.fn().mockResolvedValue({})

    const txMock = {
      movimiento_factura: { create: movimientoCreate, aggregate: movimientoAggregate },
      payment: { update: paymentUpdate },
      factura: { findUnique: facturaFind, update: facturaUpdate },
      estado_registro: { upsert: estadoUpsert },
    } as unknown as Record<string, unknown>

    const transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return await cb(txMock as unknown)
    })

    ;(prismaImport as unknown as Record<string, unknown>).payment_webhook_event = { create: pweCreate }
    ;(prismaImport as unknown as Record<string, unknown>).payment = { findUnique: paymentFind }
    ;(prismaImport as unknown as Record<string, unknown>).$transaction = transaction

    // Now call handler
    const res = await handlePayphoneWebhook(rawBody, headers)

    // Assert webhook event recorded
    expect(pweCreate).toHaveBeenCalled()
    // Assert payment was looked up
    expect(paymentFind).toHaveBeenCalledWith({ where: { provider_reference: String("tx_1") } })
    // Assert transaction executed
    expect(transaction).toHaveBeenCalled()
    // Assert movimiento created and payment updated inside tx
    expect(movimientoCreate).toHaveBeenCalled()
    expect(paymentUpdate).toHaveBeenCalled()
    // Assert result ok
    expect(res).toBeDefined()
  })
})
