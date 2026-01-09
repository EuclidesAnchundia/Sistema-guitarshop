"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import type { FieldArrayWithId, UseFieldArrayRemove, UseFieldArrayUpdate, UseFormReturn } from "react-hook-form"

import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue"
import { formatMoney, round2, toNumberSafe } from "../../../utils/number"
import { calcLineTotal } from "../../../modules/ventas/utils/salesCalc"
import type { ProductoOption } from "../types"

export type SaleCreateLineForm = {
  id_producto: number
  cantidad: string
  precio_unitario: string
  descuento?: string
}

export type SaleCreateFormValues = {
  id_cliente: number
  observacion?: string
  forma_pago: "CONTADO" | "CREDITO"
  detalle: SaleCreateLineForm[]
  creditoConfig?: unknown
}

type Props = {
  form: UseFormReturn<SaleCreateFormValues>
  fields: FieldArrayWithId<SaleCreateFormValues, "detalle", "id">[]
  productos: ProductoOption[]
  productosMap: Map<number, ProductoOption>
  remove: UseFieldArrayRemove
  update: UseFieldArrayUpdate<SaleCreateFormValues, "detalle">
  canEditPrice: boolean
}

export function SaleItemsTable({ form, fields, productos, productosMap, remove, update, canEditPrice }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editingIds, setEditingIds] = useState<Set<number>>(() => new Set())
  const inputRef = useRef<HTMLInputElement | null>(null)

  const debounced = useDebouncedValue(query)

  const productosIndex = useMemo(() => {
    return productos.map((p) => ({
      producto: p,
      search: `${p.codigo_producto} ${p.nombre_producto}`.toLowerCase(),
    }))
  }, [productos])

  const suggestions = useMemo(() => {
    const trimmed = debounced.trim().toLowerCase()
    if (trimmed.length < 2) return []

    const results: ProductoOption[] = []
    for (const entry of productosIndex) {
      if (entry.search.includes(trimmed)) {
        results.push(entry.producto)
        if (results.length >= 8) break
      }
    }
    return results
  }, [debounced, productosIndex])

  useEffect(() => {
    if (!open) return
    const handle = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-sale-product-search]") || target.closest("[data-sale-product-suggestions]")) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handle, true)
    return () => document.removeEventListener("pointerdown", handle, true)
  }, [open])

  const addProduct = (productId: number) => {
    const existingIndex = form.getValues("detalle").findIndex((l) => l.id_producto === productId)
    if (existingIndex >= 0) {
      const line = form.getValues(`detalle.${existingIndex}`)
      const currentQty = Math.trunc(toNumberSafe(line?.cantidad))
      const nextQty = Math.max(1, currentQty + 1)
      const product = productosMap.get(productId)
      const clampedQty = product ? Math.min(nextQty, product.cantidad_stock) : nextQty
      update(existingIndex, { ...line, cantidad: String(clampedQty) })
      if (product && nextQty > product.cantidad_stock) {
        form.setError(`detalle.${existingIndex}.cantidad` as const, {
          type: "validate",
          message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
        })
      }
    } else {
      const product = productosMap.get(productId)
      const precio = product ? product.precio_venta : 0
      const next = {
        id_producto: productId,
        cantidad: "1",
        precio_unitario: String(round2(precio)),
        descuento: "0",
      }
      form.setValue("detalle", [...form.getValues("detalle"), next], { shouldDirty: true, shouldTouch: true })
    }

    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }

  const toggleEdit = (productId: number) => {
    setEditingIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const updateQty = (index: number, delta: number) => {
    const line = form.getValues(`detalle.${index}`)
    const product = productosMap.get(line.id_producto)
    const currentQty = Math.trunc(toNumberSafe(line.cantidad))
    const nextQtyRaw = currentQty + delta
    const nextQty = Math.max(1, nextQtyRaw)
    const clamped = product ? Math.min(nextQty, product.cantidad_stock) : nextQty
    update(index, { ...line, cantidad: String(clamped) })

    if (product && nextQty > product.cantidad_stock) {
      form.setError(`detalle.${index}.cantidad` as const, {
        type: "validate",
        message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
      })
    } else {
      form.clearErrors(`detalle.${index}.cantidad` as const)
    }
  }

  const values = form.watch("detalle")

  return (
    <section className="space-y-4 px-6 py-5">
      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Buscar producto por código o nombre</label>
        <div className="relative mt-1" data-sale-product-search>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Ej. STRAT-001 o Fender"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

          {open && suggestions.length > 0 && (
            <div
              data-sale-product-suggestions
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              {suggestions.map((p) => (
                <button
                  key={p.id_producto}
                  type="button"
                  onClick={() => addProduct(p.id_producto)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{p.nombre_producto}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.codigo_producto} · Stock: {p.cantidad_stock} · {formatMoney(p.precio_venta)}
                    </p>
                  </div>
                  <span className="mt-0.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                    Agregar
                  </span>
                </button>
              ))}
            </div>
          )}

          {open && query.trim().length >= 2 && suggestions.length === 0 && (
            <div
              data-sale-product-suggestions
              className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-xl"
            >
              Sin resultados.
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Precio unitario</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3 text-right">Subtotal línea</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Agrega al menos un producto.
                </td>
              </tr>
            )}

            {fields.map((field, index) => {
              const line = values?.[index]
              const product = productosMap.get(line?.id_producto ?? 0)
              const isEditing = product ? editingIds.has(product.id_producto) : true

              const qty = Math.trunc(toNumberSafe(line?.cantidad))
              const stock = product?.cantidad_stock ?? null
              const stockExceeded = stock !== null && qty > stock

              const lineTotal = calcLineTotal(line?.precio_unitario, line?.cantidad, line?.descuento)

              const priceField = form.register(`detalle.${index}.precio_unitario` as const)
              const discountField = form.register(`detalle.${index}.descuento` as const)

              return (
                <tr key={field.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{product ? product.nombre_producto : "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{product ? product.codigo_producto : "Selecciona desde el buscador"}</p>
                    <p className="mt-1 text-xs text-slate-500">Stock disponible: {product ? product.cantidad_stock : "—"}</p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => updateQty(index, -1)}
                        disabled={!product || qty <= 1}
                        className="inline-flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        aria-label="Disminuir"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        {...form.register(`detalle.${index}.cantidad` as const)}
                        value={String(line?.cantidad ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value
                          const parsed = Math.trunc(toNumberSafe(raw))
                          const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
                          const clamped = product ? Math.min(Math.max(1, safe), product.cantidad_stock) : Math.max(1, safe)
                          form.setValue(`detalle.${index}.cantidad` as const, String(clamped), { shouldDirty: true, shouldTouch: true })

                          if (product && clamped > product.cantidad_stock) {
                            form.setError(`detalle.${index}.cantidad` as const, {
                              type: "validate",
                              message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
                            })
                          } else {
                            form.clearErrors(`detalle.${index}.cantidad` as const)
                          }
                        }}
                        className="h-9 w-14 border-x border-slate-200 bg-transparent text-center text-sm font-semibold text-slate-900 outline-none"
                        disabled={!product}
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(index, 1)}
                        disabled={!product || (stock !== null && qty >= stock)}
                        className="inline-flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {form.formState.errors.detalle?.[index]?.cantidad && (
                      <p className="mt-1 text-xs text-red-600">{String(form.formState.errors.detalle[index]?.cantidad?.message ?? "Cantidad inválida")}</p>
                    )}
                    {!form.formState.errors.detalle?.[index]?.cantidad && stockExceeded && (
                      <p className="mt-1 text-xs text-red-600">Stock insuficiente (disp: {stock})</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {!isEditing || !canEditPrice ? (
                      <p className="mt-2 font-semibold text-slate-900">{formatMoney(toNumberSafe(line?.precio_unitario))}</p>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        {...priceField}
                        value={String(line?.precio_unitario ?? "")}
                        onChange={priceField.onChange}
                        className="h-9 w-32 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    )}

                    {form.formState.errors.detalle?.[index]?.precio_unitario && (
                      <p className="mt-1 text-xs text-red-600">{String(form.formState.errors.detalle[index]?.precio_unitario?.message ?? "Precio inválido")}</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {!isEditing ? (
                      <p className="mt-2 font-semibold text-slate-900">{formatMoney(toNumberSafe(line?.descuento))}</p>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        {...discountField}
                        value={String(line?.descuento ?? "0")}
                        onChange={discountField.onChange}
                        className="h-9 w-28 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    )}

                    {form.formState.errors.detalle?.[index]?.descuento && (
                      <p className="mt-1 text-xs text-red-600">{String(form.formState.errors.detalle[index]?.descuento?.message ?? "Descuento inválido")}</p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <p className="mt-2 font-semibold text-slate-900">{formatMoney(lineTotal)}</p>
                  </td>

                  <td className="px-4 py-3 text-right">
                    {product && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEdit(product.id_producto)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                          {isEditing ? "Listo" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {form.formState.errors.detalle?.message && (
        <p className="text-xs text-red-600">{String(form.formState.errors.detalle.message)}</p>
      )}
    </section>
  )
}
