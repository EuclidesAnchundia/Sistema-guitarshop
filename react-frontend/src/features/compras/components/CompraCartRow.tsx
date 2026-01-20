"use client"

import { Minus, Plus, Trash2 } from "lucide-react"
import { formatMoney } from "../../../utils/number"

type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  cantidad_stock?: number | null
}

type Props = {
  product?: ProductoOption
  quantity: number
  costo: number
  subtotal: number
  stock: number | null
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
  onCostoChange: (next: number) => void
}

export default function CompraCartRow({ product, quantity, costo, subtotal, stock, onIncrement, onDecrement, onRemove, onCostoChange }: Props) {
  return (
    <tr className="group border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-900" title={product?.nombre_producto}>{product?.nombre_producto ?? "—"}</p>
        <p className="text-xs text-slate-500">{product?.codigo_producto}</p>
        {stock !== null && <p className="text-xs text-slate-500">Stock: {stock}</p>}
      </td>

      <td className="px-3 py-2">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={onDecrement} disabled={quantity <= 1} className="inline-flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
          <input type="text" value={quantity} readOnly className="h-8 w-12 border-x border-slate-200 bg-transparent text-center text-sm font-bold tabular-nums text-slate-900 outline-none" />
          <button type="button" onClick={onIncrement} className="inline-flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={String(costo)}
          onChange={(e) => onCostoChange(Number(e.target.value))}
          className="h-8 w-full rounded border border-slate-200 px-2 text-sm text-slate-900"
        />
      </td>

      <td className="px-3 py-2 text-right tabular-nums">
        <span className="text-sm font-bold text-slate-900">{formatMoney(subtotal)}</span>
      </td>

      <td className="px-3 py-2 text-right">
        <button type="button" onClick={onRemove} className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  )
}
