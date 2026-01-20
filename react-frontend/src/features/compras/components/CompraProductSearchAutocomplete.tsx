"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue"

type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  cantidad_stock?: number
  precio_compra?: number
  costo?: number
}

type Props = {
  productos: ProductoOption[]
  value?: string
  onSelect: (prod: ProductoOption | null) => void
  disabled?: boolean
}

export default function CompraProductSearchAutocomplete({ productos, value = "", onSelect, disabled }: Props) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const debounced = useDebouncedValue(query)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const productosIndex = useMemo(() => {
    return productos.map((p) => ({ producto: p, search: `${p.codigo_producto} ${p.nombre_producto}`.toLowerCase() }))
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
    if (suggestions.length > 0 && open) setSelectedIndex(0)
  }, [suggestions.length, open])

  useEffect(() => {
    if (!open) return
    const handle = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-compra-product-search]") || target.closest("[data-compra-product-suggestions]")) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handle, true)
    return () => document.removeEventListener("pointerdown", handle, true)
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      setQuery("")
      setOpen(false)
      setSelectedIndex(0)
      onSelect(null)
      return
    }

    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && suggestions.length === 1) {
        e.preventDefault()
        handleSelect(suggestions[0])
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (suggestions[selectedIndex]) handleSelect(suggestions[selectedIndex])
    }
  }

  const handleSelect = (p: ProductoOption) => {
    onSelect(p)
    setQuery(p.nombre_producto)
    setOpen(false)
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  return (
    <div className="relative" data-compra-product-search>
      <label className="text-[11px] font-medium uppercase text-slate-500">Producto</label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Código o nombre del producto..."
          disabled={disabled}
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div data-compra-product-suggestions className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((p, idx) => (
            <button
              key={p.id_producto}
              type="button"
              onClick={() => handleSelect(p)}
              className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 ${
                idx === selectedIndex ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{p.nombre_producto}</p>
                <p className="text-xs text-slate-500">{p.codigo_producto}{p.cantidad_stock !== undefined ? ` · Stock: ${p.cantidad_stock}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && suggestions.length === 0 && (
        <div data-compra-product-suggestions className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg">Sin resultados.</div>
      )}
    </div>
  )
}
