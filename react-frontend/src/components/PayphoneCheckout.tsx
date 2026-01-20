import { useState } from "react"
import { payphoneService } from "../services/payphoneService"
import { toast } from "sonner"

type Props = {
  idFactura: number
  amount: number
  currency?: string
  className?: string
}

export function PayphoneCheckout({ idFactura, amount, currency, className }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      const { payment, intent } = await payphoneService.createIntent({ id_factura: idFactura, amount, currency })
      // Store pending payment in sessionStorage so UI can show immediate PENDING state after redirect
      try {
        const key = "pending_payments"
        const raw = sessionStorage.getItem(key)
        const arr = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : []
        const payRec = payment as unknown as Record<string, unknown>
        arr.push({ id_payment: payRec.id_payment ?? null, id_factura: idFactura, status: String(payRec.status ?? "PENDING") })
        sessionStorage.setItem(key, JSON.stringify(arr))
      } catch {
        // ignore storage errors
      }
      toast?.success?.("Intención creada, redirigiendo al checkout...")
      if (!intent || !intent.paymentUrl) throw new Error("Respuesta inválida del proveedor")
      // Redirigir al checkout del proveedor
      window.location.href = intent.paymentUrl
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || "Error al crear intención de pago")
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={handleClick} disabled={loading}>
        {loading ? "Procesando..." : "Pagar con Payphone"}
      </button>
      {error && <div style={{ color: "#b00", marginTop: 8 }}>{error}</div>}
    </div>
  )
}

export default PayphoneCheckout
