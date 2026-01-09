"use client"

import { Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import type { VentaDetailRecord } from "../../../services/salesService"
import { formatMoney } from "../../../utils/number"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: VentaDetailRecord | null
  busy?: boolean
  onViewInvoice: () => void
  onPrint: () => void
  onDownloadPdf: () => void
  onCreateAnother: () => void
}

export function SaleSuccessDialog({
  open,
  onOpenChange,
  sale,
  busy,
  onViewInvoice,
  onPrint,
  onDownloadPdf,
  onCreateAnother,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content w-full max-w-lg" disableOutsideClose hideCloseButton>
        <DialogHeader>
          <DialogTitle>Venta registrada</DialogTitle>
          <DialogDescription>La factura se generó correctamente.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span>Número de factura</span>
            <span className="font-semibold text-slate-900">{sale?.numero_factura ?? "—"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Total</span>
            <span className="font-semibold text-slate-900">{formatMoney(sale?.total ?? 0)}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onViewInvoice}
            disabled={!sale || busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Ver factura
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={!sale || busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={!sale || busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={onCreateAnother}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar otra venta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
