"use client"

import { Loader2 } from "lucide-react"
import { formatMoney } from "../../../utils/number"

type Props = {
  subtotal: number
  descuento: number
  iva: number
  total: number
  hasItems: boolean
  isSubmitting: boolean
  payphoneInProgress?: boolean
  metodoPago?: "EFECTIVO" | "TRANSFERENCIA" | "PAYPHONE"
  onMetodoChange?: (next: "EFECTIVO" | "TRANSFERENCIA" | "PAYPHONE") => void
  montoAPagar?: number | string
  onMontoAPagarChange?: (next: string) => void
  onPayphoneClick?: () => void
  paymentStatus?: string | null
  onCancelPayment?: () => void
  formaPago?: "CONTADO" | "CREDITO"
  onCancel: () => void
  onDescuentoChange: (value: string) => void
  applyIva?: boolean
  onApplyIvaChange?: (next: boolean) => void
}

export function SaleSummaryPanel({
  subtotal,
  descuento,
  iva,
  total,
  hasItems,
  isSubmitting,
  payphoneInProgress,
  metodoPago,
  onMetodoChange,
  montoAPagar,
  onMontoAPagarChange,
  onPayphoneClick,
  paymentStatus,
  onCancelPayment,
  formaPago,
  onCancel,
  onDescuentoChange,
  applyIva = true,
  onApplyIvaChange,
}: Props) {
  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-slate-50">
      {/* Resumen - crece para llenar espacio */}
      <div className="flex-1 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Resumen</h3>

        <div className="mb-4">
          <label className="text-xs font-medium uppercase text-slate-500">Método de pago</label>
          <select
            value={metodoPago ?? "EFECTIVO"}
            onChange={(e) => onMetodoChange && onMetodoChange(e.target.value as "EFECTIVO" | "TRANSFERENCIA" | "PAYPHONE")}
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="PAYPHONE">PayPhone</option>
          </select>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium">{formatMoney(subtotal)}</span>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-slate-500">Descuento general</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={descuento || ''}
              onChange={(e) => onDescuentoChange(e.target.value)}
              placeholder="0.00"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          
          {descuento > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Descuento aplicado</span>
              <span className="tabular-nums font-medium">-{formatMoney(descuento)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!applyIva}
                onChange={(e) => onApplyIvaChange && onApplyIvaChange(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs uppercase">Aplicar IVA (15%)</span>
            </label>
            <span className="text-xs text-slate-500">{applyIva ? "Activado" : "Desactivado"}</span>
          </div>
          
          <div className="flex justify-between text-slate-600">
            <span>IVA (15%)</span>
            <span className="tabular-nums font-medium">{formatMoney(iva)}</span>
          </div>
          <div className="border-t border-slate-200 my-2"></div>
          {metodoPago === "PAYPHONE" && (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-slate-500">Monto a pagar ahora</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={String(montoAPagar ?? total)}
                onChange={(e) => onMontoAPagarChange && onMontoAPagarChange(e.target.value)}
                readOnly={formaPago === "CONTADO"}
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPayphoneClick && onPayphoneClick()}
                  disabled={isSubmitting || payphoneInProgress}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {paymentStatus === "PENDING" ? "Pago en proceso…" : isSubmitting || payphoneInProgress ? "Procesando..." : "Pagar con PayPhone"}
                </button>
                {metodoPago === "PAYPHONE" && paymentStatus === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => onCancelPayment && onCancelPayment()}
                    className="h-10 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Cancelar pago
                  </button>
                )}
              </div>
            </div>
          )}
          {paymentStatus === "CONFIRMED" && <div className="mt-2 text-sm text-emerald-700">Pago confirmado</div>}
          {paymentStatus === "FAILED" && <div className="mt-2 text-sm text-red-600">Pago fallido</div>}
          <div className="flex justify-between items-baseline text-slate-900">
            <span className="text-base font-bold">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* Acciones sticky al fondo */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-lg space-y-2">
        <button
          type="submit"
          disabled={!hasItems || isSubmitting || !!payphoneInProgress}
          className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              Guardar venta
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full h-10 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
