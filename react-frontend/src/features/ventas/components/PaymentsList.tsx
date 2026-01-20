import { useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { payphoneService } from "../../../services/payphoneService"
import { toast } from "sonner"

type Props = {
  facturaId: number
  saleRefetch?: () => void
}

export function PaymentsList({ facturaId, saleRefetch }: Props) {
  const prevStatuses = useRef<Record<number, string>>({})

  const query = useQuery({
    queryKey: ["payments", facturaId],
    queryFn: async () => {
      const res = await payphoneService.listByFactura(facturaId)
      return (res as { payments?: unknown[] }).payments ?? []
    },
    refetchInterval: 5000,
  })

  // Merge pending payments and detect transitions on data update
  useEffect(() => {
    const list = (query.data ?? []) as Array<Record<string, unknown>>
    // Merge with pending payments stored in sessionStorage
    let merged = list as Array<Record<string, unknown>>
    try {
      const raw = sessionStorage.getItem("pending_payments")
      if (raw) {
        const arr = JSON.parse(raw) as Array<Record<string, unknown>>
        const pendingForFactura = arr.filter((x) => Number(x.id_factura) === facturaId)
        for (const p of pendingForFactura) {
          const exists = merged.some((m) => Number((m as Record<string, unknown>).id_payment) === Number(p.id_payment))
          if (!exists) merged = [p as Record<string, unknown>, ...merged]
        }
      }
    } catch {
      // ignore
    }

    // Detect status transitions
    for (const p of list) {
      const id = Number((p as Record<string, unknown>).id_payment)
      const status = String((p as Record<string, unknown>).status ?? "PENDING")
      const prev = prevStatuses.current[id]
      if (prev && prev !== status && status === "CONFIRMED") {
        toast.success("Pago confirmado")
        if (saleRefetch) saleRefetch()
      }
      prevStatuses.current[id] = status
    }

    // Note: we don't set merged back into query.cache here; the component will read merged below
  }, [query.data, facturaId, saleRefetch])

  const payments = (query.data ?? []) as Array<Record<string, unknown>>
  if (!payments || payments.length === 0) return <div className="text-xs text-slate-500">Sin pagos registrados.</div>

  return (
    <div>
      <div className="text-xs text-slate-500">Pagos recientes:</div>
      <ul className="mt-2 space-y-2">
        {payments.map((p) => (
          <li key={String((p as Record<string, unknown>).id_payment)} className="flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{String((p as Record<string, unknown>).provider_reference ?? "-")}</div>
              <div className="text-xs text-slate-500">{String((p as Record<string, unknown>).status ?? "PENDING")}</div>
            </div>
            <div className="font-semibold">{Number((p as Record<string, unknown>).amount ?? 0).toFixed(2)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PaymentsList
