"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, Check } from "lucide-react"
import { useDebouncedValue } from "../lib/hooks/useDebouncedValue"

type GenericProps<T, IdT = number | string> = {
  items: T[]
  getLabel: (item: T) => string
  getSubLabel?: (item: T) => string | undefined
  onSelect: (item: T | null) => void
  valueId?: IdT | null
  placeholder?: string
  emptyText?: string
  loading?: boolean
  getId?: (item: T) => IdT
}


export default function GenericAutocomplete<T, IdT = number | string>({
  items,
  getLabel,
  getSubLabel,
  onSelect,
  valueId = null,
  placeholder = "Buscar...",
  emptyText = "Sin resultados.",
  loading = false,
  getId,
}: GenericProps<T, IdT>) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const debounced = useDebouncedValue(query)

  const index = useMemo(() => {
    return items.map((it) => ({ it, search: `${getLabel(it)} ${getSubLabel?.(it) ?? ""}`.toLowerCase() }))
  }, [items, getLabel, getSubLabel])

  const suggestions = useMemo(() => {
    const t = debounced.trim().toLowerCase()
    if (t.length < 1) return []
    const res: T[] = []
    for (const e of index) {
      if (e.search.includes(t)) {
        res.push(e.it)
        if (res.length >= 8) break
      }
    }
    return res
  }, [debounced, index])

  useEffect(() => {
    if (open && suggestions.length > 0) setSelectedIndex(0)
  }, [open, suggestions.length])

  useEffect(() => {
    if (!open) return
    const handle = (ev: PointerEvent) => {
      const target = ev.target
      if (!(target instanceof Element)) return
      if (containerRef.current && containerRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handle, true)
    return () => document.removeEventListener("pointerdown", handle, true)
  }, [open])

  const containerRef = useRef<HTMLDivElement | null>(null)

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
        handleSelect(suggestions[0])
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((s) => (s + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((s) => (s - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (suggestions[selectedIndex]) handleSelect(suggestions[selectedIndex])
    }
  }

  const resolveId = useCallback(
    (item: T): IdT | undefined => {
      if (getId) return getId(item)
      const obj = item as unknown as Record<string, unknown>
      const fallback = obj.id ?? obj.id_cliente ?? obj.id_proveedor ?? obj.id_usuario
      return (fallback as IdT) ?? undefined
    },
    [getId]
  )

  const handleSelect = (item: T) => {
    onSelect(item)
    setQuery(getLabel(item))
    setOpen(false)
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  // sync external valueId -> show label
  useEffect(() => {
    if (valueId == null) return setQuery("")
    const found = items.find((it) => {
      const id = resolveId(it)
      // compare as strings to tolerate number/string id types
      return String(id) === String(valueId)
    })
    if (found) {
      setQuery(getLabel(found))
    }
  }, [valueId, items, getLabel, resolveId])

  return (
    <div className="relative" ref={containerRef}>
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
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-autocomplete="list"
          role="combobox"
          spellCheck={false}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-600">Cargando...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((s, idx) => (
              <button
                key={String(resolveId(s)) + "-" + idx}
                type="button"
                onClick={() => handleSelect(s)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 ${
                  idx === selectedIndex ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{getLabel(s)}</p>
                  {getSubLabel && <p className="text-xs text-slate-500">{getSubLabel(s)}</p>}
                </div>
                {selectedIndex === idx && <Check className="h-5 w-5 text-emerald-600" />}
              </button>
            ))
          ) : debounced.trim().length > 0 ? (
            <div className="px-3 py-2 text-sm text-slate-600">{emptyText}</div>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-600">Escribe para buscar</div>
          )}
        </div>
      )}
    </div>
  )
}
