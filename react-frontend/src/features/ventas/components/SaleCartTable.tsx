"use client"

import { ShoppingCart } from "lucide-react"
import { SaleCartRow } from "./SaleCartRow"
import type { SaleCreateFormValues } from "./SaleItemsTable"
import type { ProductoOption } from "../types"
import { calcLineTotal } from "../../../modules/ventas/utils/salesCalc"
import { toNumberSafe } from "../../../utils/number"

type Props = {
  items: SaleCreateFormValues["detalle"]
  productosMap: Map<number, ProductoOption>
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

export function SaleCartTable({ items, productosMap, onIncrement, onDecrement, onRemove, disabled = false }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-[calc(100vh-280px)] flex-col items-center justify-center text-slate-400">
        <ShoppingCart className="h-12 w-12 mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">Busca un producto por código o nombre</p>
        <p className="mt-1 text-xs text-slate-500">Presiona <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">Enter</kbd> para agregar</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-280px)] overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              Producto
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              Cant.
            </th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
              P.Unit
            </th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
              Subtotal
            </th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items.map((line, index) => {
            const product = productosMap.get(line?.id_producto ?? 0)
            const qty = Math.trunc(toNumberSafe(line?.cantidad))
            const price = toNumberSafe(line?.precio_unitario)
            const stock = product?.cantidad_stock ?? null
            const stockExceeded = stock !== null && qty > stock
            const lineTotal = calcLineTotal(line?.precio_unitario, line?.cantidad, line?.descuento)

            return (
              <SaleCartRow
                key={index}
                product={product}
                quantity={qty}
                price={price}
                subtotal={lineTotal}
                stockExceeded={stockExceeded}
                stock={stock}
                onIncrement={() => onIncrement(index)}
                onDecrement={() => onDecrement(index)}
                onRemove={() => onRemove(index)}
                disabled={disabled}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
