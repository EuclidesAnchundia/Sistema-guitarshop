import crypto from "crypto"
import { describe, test, expect, beforeEach } from "vitest"
import { verifySignature } from "../lib/services/payphone.webhook"

describe("payphone webhook signature", () => {
  const secret = "test_secret_123"
  beforeEach(() => {
    process.env.PAYPHONE_WEBHOOK_SECRET = secret
  })

  test("valid signature passes", () => {
    const body = JSON.stringify({ id: "evt_1", data: { foo: "bar" } })
    const mac = crypto.createHmac("sha256", secret).update(body).digest("hex")
    const headers: Record<string, string> = { "x-payphone-signature": mac }
    expect(() => verifySignature(body, headers)).not.toThrow()
  })

  test("invalid signature throws", () => {
    const body = JSON.stringify({ id: "evt_2" })
    const headers: Record<string, string> = { "x-payphone-signature": "deadbeef" }
    expect(() => verifySignature(body, headers)).toThrow()
  })
})
