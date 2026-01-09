import type { VentaDetailRecord } from "../../../services/salesService"
import { SaleInvoiceDocument } from "./SaleInvoiceDocument"

type Props = {
  sale: VentaDetailRecord
}

export function InvoicePrint({ sale }: Props) {
  return (
    <div id="invoice-print">
      <SaleInvoiceDocument sale={sale} />
    </div>
  )
}
