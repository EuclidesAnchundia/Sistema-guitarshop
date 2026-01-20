"use client"

import CompraCartRow from "./CompraCartRow"
import { ShoppingCart } from "lucide-react"
// import { toNumberSafe } from "../../../utils/number"
 
 type DetalleCompra = {
   id_producto: number
   cantidad: number
   costo_unitario: number
 }
 
 type ProductoOption = {
   id_producto: number
   nombre_producto: string
   codigo_producto: string
   cantidad_stock?: number | null
   precio_compra?: number
   costo?: number
 }

type Props = {
  items: DetalleCompra[]
  productosMap: Map<number, ProductoOption>
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
  onRemove: (index: number) => void
  onCostoChange: (index: number, next: number) => void
}

export default function CompraCartTable({ items, productosMap, onIncrement, onDecrement, onRemove, onCostoChange }: Props) {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400">
        <ShoppingCart className="h-12 w-12 mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">Busca un producto por código o nombre</p>
        <p className="mt-1 text-xs text-slate-500">Presiona <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">Enter</kbd> para agregar</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Producto</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Cant.</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Costo</th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Subtotal</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items.map((line, index) => {
            const product = productosMap.get(line.id_producto) as ProductoOption | undefined
            const qty = Math.trunc(line.cantidad)
            const costo = Number(line.costo_unitario)
            const stock = product?.cantidad_stock ?? null
            const subtotal = Number((qty * (costo || 0)).toFixed(2))

            return (
              <CompraCartRow
                key={index}
                product={product}
                quantity={qty}
                costo={costo}
                subtotal={subtotal}
                stock={stock}
                onIncrement={() => onIncrement(index)}
                onDecrement={() => onDecrement(index)}
                onRemove={() => onRemove(index)}
                onCostoChange={(next) => onCostoChange(index, next)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
