"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ProductoOption } from "../types"
import { formatMoney } from "../../../utils/number"
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue"

type Props = {
  productos: ProductoOption[]
  onAddProduct: (productId: number) => void
  disabled?: boolean
}

export function SaleSearchBar({ productos, onAddProduct, disabled }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
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
      if (target.closest("[data-sale-search]") || target.closest("[data-sale-suggestions]")) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handle, true)
    return () => document.removeEventListener("pointerdown", handle, true)
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && suggestions.length === 1) {
      e.preventDefault()
      onAddProduct(suggestions[0].id_producto)
      setQuery("")
      setOpen(false)
      inputRef.current?.focus()
    }
  }

  const handleSelect = (productId: number) => {
    onAddProduct(productId)
    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="sticky top-0 z-10 bg-white pb-3 pt-4" data-sale-search>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por código o nombre..."
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50"
          autoFocus
        />

        {open && suggestions.length > 0 && (
          <div
            data-sale-suggestions
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            {suggestions.map((p) => (
              <button
                key={p.id_producto}
                type="button"
                onClick={() => handleSelect(p.id_producto)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{p.nombre_producto}</p>
                  <p className="text-xs text-slate-500">
                    {p.codigo_producto} · Stock: {p.cantidad_stock}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-emerald-700">
                  {formatMoney(p.precio_venta)}
                </span>
              </button>
            ))}
          </div>
        )}

        {open && query.trim().length >= 2 && suggestions.length === 0 && (
          <div
            data-sale-suggestions
            className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg"
          >
            Sin resultados.
          </div>
        )}
      </div>
    </div>
  )
}
