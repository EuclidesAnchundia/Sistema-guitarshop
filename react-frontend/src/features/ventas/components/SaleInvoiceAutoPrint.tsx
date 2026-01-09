import { useEffect, useRef } from "react"

import type { VentaDetailRecord } from "../../../services/salesService"
import { InvoicePrint } from "./InvoicePrint"
import { PrintRootPortal } from "./PrintRootPortal"

type Props = {
  enabled: boolean
  sale: VentaDetailRecord | null
  onDone: () => void
}

export function SaleInvoiceAutoPrint({ enabled, sale, onDone }: Props) {
  const printedForSaleIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !sale) return

    // Evitar re-impresiones por re-render.
    if (printedForSaleIdRef.current === sale.id_factura) return

    const handleAfterPrint = () => {
      printedForSaleIdRef.current = null
      onDone()
    }

    window.addEventListener("afterprint", handleAfterPrint)

    // Dejar que el portal/render termine antes de imprimir.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        printedForSaleIdRef.current = sale.id_factura
        window.print()
      })
    })

    return () => {
      window.removeEventListener("afterprint", handleAfterPrint)
    }
  }, [enabled, sale, onDone])

  if (!enabled || !sale) return null

  return (
    <PrintRootPortal>
      <InvoicePrint sale={sale} />
    </PrintRootPortal>
  )
}
