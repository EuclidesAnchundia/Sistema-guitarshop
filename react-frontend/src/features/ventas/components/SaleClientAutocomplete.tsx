"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Check } from "lucide-react"
import type { ClienteOption } from "../types"
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue"

type Props = {
  clientes: ClienteOption[]
  onSelectCliente: (cliente: ClienteOption | null) => void
  onSelectConsumidorFinal: () => void
  disabled?: boolean
}

export function SaleClientAutocomplete({
  clientes,
  onSelectCliente,
  onSelectConsumidorFinal,
  disabled,
}: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const debounced = useDebouncedValue(query)

  const clientesIndex = useMemo(() => {
    return clientes.map((c) => ({
      cliente: c,
      search: `${c.nombres} ${c.apellidos} ${c.cedula}`.toLowerCase(),
    }))
  }, [clientes])

  const suggestions = useMemo(() => {
    const trimmed = debounced.trim().toLowerCase()
    if (trimmed.length < 1) return []

    const results: ClienteOption[] = []
    for (const entry of clientesIndex) {
      if (entry.search.includes(trimmed)) {
        results.push(entry.cliente)
        if (results.length >= 8) break
      }
    }
    return results
  }, [debounced, clientesIndex])

  useEffect(() => {
    if (suggestions.length > 0 && open) {
      setSelectedIndex(0)
    }
  }, [suggestions.length, open])

  useEffect(() => {
    if (!open) return
    const handle = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-client-search]") || target.closest("[data-client-suggestions]")) return
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
      return
    }

    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && suggestions.length === 1) {
        e.preventDefault()
        handleSelectCliente(suggestions[0])
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
      if (suggestions[selectedIndex]) {
        handleSelectCliente(suggestions[selectedIndex])
      }
    }
  }

  const handleSelectCliente = (cliente: ClienteOption) => {
    onSelectCliente(cliente)
    setQuery(`${cliente.nombres} ${cliente.apellidos}`)
    setOpen(false)
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  const handleSelectConsumidorFinal = () => {
    onSelectConsumidorFinal()
    setQuery("Consumidor Final")
    setOpen(false)
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  return (
    <div className="relative" data-client-search>
      <label className="text-xs font-medium uppercase text-slate-500">Cliente</label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre, apellido o cédula..."
          disabled={disabled}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
        />
      </div>

      {open && (
        <div
          data-client-suggestions
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {/* Opción: Consumidor Final */}
          <button
            type="button"
            onClick={handleSelectConsumidorFinal}
            className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 ${
              selectedIndex === -1 ? "bg-emerald-50" : "hover:bg-slate-50"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">Consumidor Final</p>
              <p className="text-xs text-slate-500">Sin datos específicos</p>
            </div>
            {selectedIndex === -1 && <Check className="h-5 w-5 text-emerald-600" />}
          </button>

          {/* Resultados de búsqueda */}
          {suggestions.length > 0 ? (
            suggestions.map((c, idx) => (
              <button
                key={c.id_cliente}
                type="button"
                onClick={() => handleSelectCliente(c)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 ${
                  idx === selectedIndex ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {c.nombres} {c.apellidos}
                  </p>
                  <p className="text-xs text-slate-500">Cédula: {c.cedula}</p>
                </div>
                {selectedIndex === idx && <Check className="h-5 w-5 text-emerald-600" />}
              </button>
            ))
          ) : query.trim().length >= 1 ? (
            <div className="px-3 py-2 text-sm text-slate-600">Sin resultados.</div>
          ) : (
            <div className="px-3 py-2 text-xs text-slate-500">Escribe para buscar o selecciona Consumidor Final</div>
          )}
        </div>
      )}
    </div>
  )
}
