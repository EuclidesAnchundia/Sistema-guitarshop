"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ClipboardList,
  Eye,
  Loader2,
  Plus,
  ShieldAlert,
} from "lucide-react"

import { api } from "../../lib/apiClient"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { ComprasListHeader } from "./components/ComprasListHeader"
import { ComprasFiltersDrawer, type ComprasFiltersDraft } from "./components/ComprasFiltersDrawer"
import { ComprasDetailDrawer } from "./components/ComprasDetailDrawer"

import type { CompraDetailRecord, CompraListRecord, ProductoCompraItem } from "./compra.types"
import { useComprasQuery } from "./useComprasQuery"
import { exportToCSV, exportToPDF, exportToXLSX, type ExportRow } from "./exportCompras"

type ProveedorOption = {
  id_proveedor: number
  nombre_proveedor: string
}

type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
}

const PAGE_SIZE_STORAGE_KEY = "compras.pageSize"
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 20

const defaultFiltersDraft: ComprasFiltersDraft = {
  fechaDesde: "",
  fechaHasta: "",
  proveedor: "",
  totalMin: "",
  totalMax: "",
}

// Cada fila del detalle respeta las mismas validaciones que el backend.
const detalleSchema = z.object({
  id_producto: z.number().int("Producto inválido").positive("Selecciona un producto válido"),
  cantidad: z.number().int("Debe ser entero").min(1, "Cantidad mínima 1"),
  costo_unitario: z.number().min(0.01, "Costo mínimo 0.01"),
})

type DetalleCompra = z.infer<typeof detalleSchema>

// Cabecera completa: proveedor + observación + listado de productos.
const compraSchema = z.object({
  id_proveedor: z.number().int("Proveedor inválido").positive("Selecciona un proveedor"),
  observacion: z
    .string()
    .trim()
    .max(255, "Máximo 255 caracteres")
    .optional()
    .or(z.literal("")),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto al detalle"),
})

type CompraFormValues = z.infer<typeof compraSchema>

type CompraPayload = {
  id_proveedor: number
  observacion: string | null
  detalle: Array<{
    id_producto: number
    cantidad: number
    costo_unitario: number
  }>
}

type ApiErrorResponse = {
  error?: string
  message?: string
}

// Formulario nace con una fila para que el usuario tenga contexto inmediato.
const defaultValues: CompraFormValues = {
  id_proveedor: 0,
  observacion: "",
  detalle: [
    {
      id_producto: 0,
      cantidad: 1,
      costo_unitario: 0,
    },
  ],
}

// Mantenemos todas las cifras de compra en USD con 2 decimales.
const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

// Las fechas de compra muestran día y hora para auditoría rápida.
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
})

const IVA_RATE = 0.15 // 15 % IVA

// Error helper compartido entre los mutate y las queries.
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

const useFloatingMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (ref.current && ref.current.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return { open, setOpen, ref }
}

export default function ComprasPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Estado para funcionalidades avanzadas
  const [searchInput, setSearchInput] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<ComprasFiltersDraft>({ ...defaultFiltersDraft })
  const [filtersDraft, setFiltersDraft] = useState<ComprasFiltersDraft>({ ...defaultFiltersDraft })
  const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
		if (typeof window === "undefined") return DEFAULT_PAGE_SIZE
		try {
			const raw = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
			if (!raw) return DEFAULT_PAGE_SIZE
			const parsed = Number(raw)
			return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE
		} catch {
			return DEFAULT_PAGE_SIZE
		}
	})
  const [currentPage, setCurrentPage] = useState(1)

	useEffect(() => {
		try {
			window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize))
		} catch {
			// noop
		}
	}, [pageSize])

  // React Hook Form + Zod se encargan de validar cada campo del modal.
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(compraSchema),
    defaultValues,
  })

  // Permite añadir/quitar filas dinámicamente y mantener los índices sincronizados.
  const detalleFieldArray = useFieldArray({ control: form.control, name: "detalle" })

  // Traemos la lista completa de compras sólo para administradores.
  const comprasQuery = useComprasQuery({ enabled: isAdmin })

  const proveedoresQuery = useQuery<ProveedorOption[]>({
    queryKey: ["proveedores"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<ProveedorOption[]>("/proveedor")
      return Array.isArray(data) ? data : []
    },
  })

  // Catálogo resumido para poblar el selector de productos.
  const productosQuery = useQuery<ProductoOption[]>({
    queryKey: ["productos-catalogo"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<ProductoOption[]>("/producto")
      if (!Array.isArray(data)) return []
      return data.map((item: ProductoOption) => ({
        id_producto: item.id_producto,
        nombre_producto: item.nombre_producto,
        codigo_producto: item.codigo_producto,
      }))
    },
  })

  // Modal secundario que muestra la compra con sus productos.
  const compraDetalleQuery = useQuery<CompraDetailRecord>({
    queryKey: ["compra", detailId],
    enabled: detailId !== null,
    queryFn: async () => {
      const { data } = await api.get<CompraDetailRecord>(`/compra/${detailId}`)
      return data
    },
  })

  // Limpia todo cuando cerramos el modal principal.
  const closeDialog = () => {
    setDialogOpen(false)
    setFormError(null)
    form.reset(defaultValues)
  }

  // Abre el modal en blanco para la creación.
  const openCreate = () => {
    setFormError(null)
    form.reset(defaultValues)
    setDialogOpen(true)
  }

  // Normalizamos strings y armamos la carga útil que espera el backend.
  const buildPayload = (values: CompraFormValues): CompraPayload => ({
    id_proveedor: values.id_proveedor,
    observacion: values.observacion?.trim() ? values.observacion.trim() : null,
    detalle: values.detalle.map((item: DetalleCompra) => ({
      id_producto: item.id_producto,
      cantidad: item.cantidad,
      costo_unitario: item.costo_unitario,
    })),
  })

  // POST /compra y posterior invalidación para refrescar la tabla.
  const createMutation = useMutation({
    mutationFn: (payload: CompraPayload) => api.post("/compra", payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compras"] })
      closeDialog()
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error, "No se pudo registrar la compra"))
    },
  })

  // Handler compartido tanto para crear desde cero como para duplicar futuras compras.
  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(buildPayload(values))
  })

	// Funciones para filtros y navegación
	const openFilters = () => {
    setFiltersDraft(filters)
    setFiltersOpen(true)
  }

  const cancelFilters = () => {
    setFiltersDraft(filters)
    setFiltersOpen(false)
  }

  const clearDraft = () => {
    setFiltersDraft({ ...defaultFiltersDraft })
  }

  const applyDraft = () => {
    setFilters({ ...filtersDraft })
    setFiltersOpen(false)
    setCurrentPage(1)
  }

  const removeChip = (key: keyof ComprasFiltersDraft) => {
    setFilters((prev) => ({ ...prev, [key]: "" }))
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setSearchInput("")
    setFilters({ ...defaultFiltersDraft })
    setFiltersDraft({ ...defaultFiltersDraft })
    setCurrentPage(1)
  }

  const handleChangePageSize = (size: PageSizeOption) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const compras = useMemo(() => comprasQuery.data ?? [], [comprasQuery.data])
  const proveedores = proveedoresQuery.data ?? []
  const productos = productosQuery.data ?? []

  // Lógica de filtrado y búsqueda
  const filteredCompras = useMemo(() => {
    let filtered = compras
		const normalizedSearch = searchInput.trim().toLowerCase()

    // Filtro de búsqueda
    if (normalizedSearch) {
			const normalizedIdSearch = normalizedSearch.startsWith("#") ? normalizedSearch.slice(1) : normalizedSearch
      filtered = filtered.filter((compra) => {
				const proveedor = compra.proveedor?.nombre_proveedor?.toLowerCase() ?? ""
				return (
					proveedor.includes(normalizedSearch) ||
					compra.id_compra.toString().includes(normalizedIdSearch) ||
					compra.fecha_compra.toLowerCase().includes(normalizedSearch)
				)
			})
    }

    // Filtros avanzados
    if (filters.fechaDesde) {
      filtered = filtered.filter((compra) => compra.fecha_compra >= filters.fechaDesde)
    }
    if (filters.fechaHasta) {
      filtered = filtered.filter((compra) => compra.fecha_compra <= filters.fechaHasta)
    }
    if (filters.proveedor) {
      filtered = filtered.filter((compra) => compra.proveedor?.nombre_proveedor === filters.proveedor)
    }
    if (filters.totalMin) {
      const min = parseFloat(filters.totalMin)
      if (!Number.isNaN(min)) {
				filtered = filtered.filter((compra) => compra.total >= min)
			}
    }
    if (filters.totalMax) {
      const max = parseFloat(filters.totalMax)
      if (!Number.isNaN(max)) {
				filtered = filtered.filter((compra) => compra.total <= max)
			}
    }

    return filtered
  }, [compras, searchInput, filters])

  // Paginación
  const totalPages = useMemo(() => {
		return Math.max(1, Math.ceil(filteredCompras.length / pageSize))
	}, [filteredCompras.length, pageSize])

	useEffect(() => {
		setCurrentPage((page) => Math.min(page, totalPages))
	}, [totalPages])

  const paginatedCompras = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredCompras.slice(startIndex, startIndex + pageSize)
  }, [filteredCompras, currentPage, pageSize])

  const startItem = filteredCompras.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredCompras.length)

  // Chips de filtros activos
  const filterChips = useMemo(() => {
    const chips = [] as Array<{ key: keyof ComprasFiltersDraft; label: string }>
		if (filters.fechaDesde) chips.push({ key: "fechaDesde", label: `Desde: ${filters.fechaDesde}` })
		if (filters.fechaHasta) chips.push({ key: "fechaHasta", label: `Hasta: ${filters.fechaHasta}` })
		if (filters.proveedor) chips.push({ key: "proveedor", label: `Proveedor: ${filters.proveedor}` })
		if (filters.totalMin) chips.push({ key: "totalMin", label: `Total min: $${filters.totalMin}` })
		if (filters.totalMax) chips.push({ key: "totalMax", label: `Total max: $${filters.totalMax}` })
    return chips
  }, [filters])

  // KPIs que alimentan las tarjetas superiores.
  const totalInvertido = useMemo(
    () => compras.reduce((acc, compra) => acc + (compra.total ?? 0), 0),
    [compras]
  )

  const detalleValues = form.watch("detalle")
  const totals = useMemo(() => {
    const items = Array.isArray(detalleValues) ? detalleValues : []
    let subtotal = 0
    items.forEach((item) => {
      if (item.cantidad && item.costo_unitario) {
        subtotal += item.cantidad * item.costo_unitario
      }
    })
    const impuesto = Number((subtotal * IVA_RATE).toFixed(2))
    const total = Number((subtotal + impuesto).toFixed(2))
    return { subtotal, impuesto, total }
  }, [detalleValues])

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar compras.</p>
          </div>
        </div>
      </div>
    )
  }

  const proveedoresNoDisponibles = proveedoresQuery.isError
  const productosNoDisponibles = productosQuery.isError
  const noProveedoresDisponibles = !proveedoresQuery.isLoading && proveedores.length === 0
  const noProductosDisponibles = !productosQuery.isLoading && productos.length === 0
  const disableCreate = proveedoresNoDisponibles || productosNoDisponibles || noProveedoresDisponibles || noProductosDisponibles

  const toExportRow = (compra: CompraListRecord): ExportRow => ({
    "ID Compra": String(compra.id_compra),
    "Proveedor": compra.proveedor?.nombre_proveedor ?? "—",
    "Fecha Compra": dateFormatter.format(new Date(compra.fecha_compra)),
    "Total": currency.format(compra.total ?? 0),
    "Fecha Registro": "—",
  })

  const CompraActionsMenu = ({ compra }: { compra: CompraListRecord }) => {
    const menu = useFloatingMenu()
    const baseName = `compra_${compra.id_compra}`
    const rows = [toExportRow(compra)]
    return (
      <div ref={menu.ref} className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            menu.setOpen((prev) => !prev)
          }}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          aria-label="Menú"
          title="Más acciones"
        >
          ⋯
        </button>
        {menu.open && (
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                exportToCSV(rows, baseName)
                menu.setOpen(false)
              }}
              className="flex w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                exportToXLSX(rows, baseName)
                menu.setOpen(false)
              }}
              className="flex w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                exportToPDF(rows, baseName)
                menu.setOpen(false)
              }}
              className="flex w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Exportar PDF
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="compras-encabezado" className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p id="compras-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Logística
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Compras</h1>
            <p className="mt-1 text-sm text-slate-500">Controla el abastecimiento y el impacto en inventario.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
            <button
              onClick={openCreate}
              disabled={disableCreate}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
              Nueva compra
            </button>
            {proveedoresNoDisponibles || productosNoDisponibles ? (
              <p className="text-xs text-amber-700">No se pudieron cargar catálogos. Intenta nuevamente.</p>
            ) : noProveedoresDisponibles ? (
              <p className="text-xs text-amber-700">Crea un proveedor para habilitar este módulo.</p>
            ) : noProductosDisponibles ? (
              <p className="text-xs text-amber-700">Crea productos para registrar compras.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="compras-resumen" className="space-y-3">
        <div className="flex items-center justify-between">
          <p id="compras-resumen" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resumen
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {comprasQuery.isLoading && comprasQuery.data === undefined
            ? Array.from({ length: 3 }).map((_, index) => (
                <article key={`compras-kpi-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="animate-pulse">
                    <div className="h-3 w-28 rounded bg-slate-100" />
                    <div className="mt-3 h-10 w-24 rounded bg-slate-100" />
                    <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
                  </div>
                </article>
              ))
            : (
                <>
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={clearAllFilters}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        clearAllFilters()
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <p className="text-xs uppercase text-slate-500">Compras registradas</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{compras.length}</p>
                    <p className="text-sm text-slate-500">Cabeceras totales en el sistema</p>
                  </article>
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={openFilters}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openFilters()
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <p className="text-xs uppercase text-slate-500">Capital invertido</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{currency.format(totalInvertido)}</p>
                    <p className="text-sm text-slate-500">Incluye IVA al 15 %</p>
                  </article>
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={openFilters}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openFilters()
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <p className="text-xs uppercase text-slate-500">Proveedores activos</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{proveedores.length}</p>
                    <p className="text-sm text-slate-500">Disponibles para nuevas órdenes</p>
                  </article>
                </>
              )}
        </div>
      </section>

      {comprasQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Error al cargar datos. Intenta nuevamente.
            </div>
            <button
              type="button"
              onClick={() => {
                comprasQuery.refetch()
                proveedoresQuery.refetch()
                productosQuery.refetch()
              }}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      <section aria-labelledby="compras-listado" className="rounded-2xl border border-slate-200 bg-white">
        <ComprasListHeader
          startItem={startItem}
          endItem={endItem}
          resultsCount={filteredCompras.length}
          searchInput={searchInput}
          onSearchInputChange={(next) => {
            setSearchInput(next)
            setCurrentPage(1)
          }}
          onOpenFilters={openFilters}
          filterChips={filterChips}
          onRemoveChip={removeChip}
          onClearAllFilters={clearAllFilters}
        />

        <div className="px-6 pb-6">
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4">Compra</th>
                  <th className="py-3 pr-4">Proveedor</th>
                  <th className="py-3 pr-4">Totales</th>
                  <th className="py-3 pr-4">Usuario</th>
                  <th className="py-3 pr-4">Detalle</th>
                  <th className="py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comprasQuery.isLoading && comprasQuery.data === undefined
                  ? Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                      <tr key={`compras-skeleton-${index}`} className="animate-pulse">
                        <td className="py-3 pr-4 align-top">
                          <div className="h-4 w-32 rounded bg-slate-100" />
                          <div className="mt-2 h-3 w-44 rounded bg-slate-100" />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="h-4 w-40 rounded bg-slate-100" />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="h-3 w-40 rounded bg-slate-100" />
                          <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="h-4 w-36 rounded bg-slate-100" />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="h-10 w-20 rounded-xl bg-slate-100" />
                        </td>
                        <td className="py-3 pr-4 align-top text-right">
                          <div className="ml-auto h-10 w-10 rounded-xl bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : paginatedCompras.map((compra) => (
                      <tr key={compra.id_compra} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 align-top">
                          <p className="text-sm font-semibold text-slate-900">Compra #{compra.id_compra}</p>
                          <p className="mt-1 text-xs text-slate-500">{dateFormatter.format(new Date(compra.fecha_compra))}</p>
                        </td>
                        <td className="py-3 pr-4 align-top text-sm font-semibold text-slate-900">
                          {compra.proveedor?.nombre_proveedor ?? "—"}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <p className="text-xs font-semibold text-slate-900">Total: {currency.format(compra.total ?? 0)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Subtotal {currency.format(compra.subtotal ?? 0)} · IVA {currency.format(compra.impuesto ?? 0)}
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top text-sm font-semibold text-slate-900">
                          {compra.usuario?.nombre_completo ?? "—"}
                        </td>
                        <td className="py-3 pr-4 align-top" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setDetailId(compra.id_compra)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            aria-label="Ver"
                          >
                            <Eye className="mr-1 inline h-4 w-4" />
                            Ver
                          </button>
                        </td>
                        <td className="py-3 pr-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end">
							<CompraActionsMenu compra={compra} />
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5">
              <div className="text-sm font-medium text-slate-600">Página {currentPage} de {totalPages}</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Anterior
                </button>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Siguiente
                </button>
              </div>

              <div className="inline-flex items-center gap-3">
                <label htmlFor="compras-page-size-bottom" className="text-sm font-semibold text-slate-800">
                  Por página
                </label>
                <select
                  id="compras-page-size-bottom"
                  value={String(pageSize)}
                  onChange={(event) => handleChangePageSize(Number(event.target.value) as PageSizeOption)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {comprasQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando compras...
          </div>
        )}

        {!comprasQuery.isLoading && paginatedCompras.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <ClipboardList size={36} className="mx-auto mb-2 opacity-50" />
            <p>{filteredCompras.length === 0 ? "No hay compras registradas." : "No se encontraron compras con los filtros aplicados."}</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={openCreate}
                disabled={disableCreate}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" />
                Nueva compra
              </button>
            </div>
          </div>
        )}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeDialog}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8 sm:p-10" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Registrar compra</h2>
              <p className="text-sm text-slate-600">Los movimientos actualizarán stock y kardex automáticamente.</p>
            </div>

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-8">

            <div className="mt-4 space-y-5">


              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
Proveedor</label>
                <select
                  {...form.register("id_proveedor", { valueAsNumber: true })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={proveedoresQuery.isLoading}
                >
                  <option value={0}>Selecciona un proveedor</option>
                  {proveedores.map((prov: ProveedorOption) => (
                    <option key={prov.id_proveedor} value={prov.id_proveedor}>
                      {prov.nombre_proveedor}
                    </option>
                  ))}
                </select>
                {form.formState.errors.id_proveedor && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.id_proveedor.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-slate-500">Observación</label>
                <input
                  {...form.register("observacion")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ej. Compra inicial"
                />
                {form.formState.errors.observacion && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.observacion.message}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase text-slate-500">Detalle de productos</label>
                <button
                  type="button"
                  onClick={() => detalleFieldArray.append({ id_producto: 0, cantidad: 1, costo_unitario: 0 })}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {detalleFieldArray.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2fr,1fr,1fr,auto]">
                    <div>
                      <label className="text-[11px] font-medium uppercase text-slate-500">Producto</label>
                      <select
                        {...form.register(`detalle.${index}.id_producto` as const, { valueAsNumber: true })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={productosQuery.isLoading}
                      >
                        <option value={0}>Selecciona un producto</option>
                        {productos.map((prod: ProductoOption) => (
                          <option key={prod.id_producto} value={prod.id_producto}>
                            {prod.nombre_producto}
                          </option>
                        ))}
                      </select>
                      {form.formState.errors.detalle?.[index]?.id_producto && (
                        <p className="mt-1 text-xs text-red-600">
                          {form.formState.errors.detalle[index]?.id_producto?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase text-slate-500">Cantidad</label>
                      <input
                        type="number"
                        step={1}
                        {...form.register(`detalle.${index}.cantidad` as const, { valueAsNumber: true })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {form.formState.errors.detalle?.[index]?.cantidad && (
                        <p className="mt-1 text-xs text-red-600">
                          {form.formState.errors.detalle[index]?.cantidad?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase text-slate-500">Costo unitario</label>
                      <input
                        type="number"
                        step="0.01"
                        {...form.register(`detalle.${index}.costo_unitario` as const, { valueAsNumber: true })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {form.formState.errors.detalle?.[index]?.costo_unitario && (
                        <p className="mt-1 text-xs text-red-600">
                          {form.formState.errors.detalle[index]?.costo_unitario?.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <p className="text-xs font-semibold text-slate-600">
                        {currency.format(
                          (detalleValues?.[index]?.cantidad || 0) * (detalleValues?.[index]?.costo_unitario || 0)
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => detalleFieldArray.remove(index)}
                        disabled={detalleFieldArray.fields.length === 1}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-slate-300 disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {form.formState.errors.detalle?.message && (
                <p className="mt-2 text-xs text-red-600">{form.formState.errors.detalle.message}</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{currency.format(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>IVA (15 %)</span>
                <span>{currency.format(totals.impuesto)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{currency.format(totals.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {detailId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailId(null)}>
          <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Detalle de compra</h2>
              <p className="text-sm text-slate-600">Incluye cabecera y productos asociados.</p>
            </div>

          {compraDetalleQuery.isLoading && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </div>
          )}

          {compraDetalleQuery.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No se pudo cargar el detalle. Intenta nuevamente.
            </div>
          )}

          {compraDetalleQuery.data && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="text-sm font-semibold text-slate-900">
                  Compra #{compraDetalleQuery.data.id_compra}
                </p>
                <p className="text-xs text-slate-500">
                  {dateFormatter.format(new Date(compraDetalleQuery.data.fecha_compra))}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Proveedor: {compraDetalleQuery.data.proveedor?.nombre_proveedor ?? "—"}
                </p>
                <p className="text-sm text-slate-700">
                  Registrada por: {compraDetalleQuery.data.usuario?.nombre_completo ?? "—"}
                </p>
                {compraDetalleQuery.data.observacion && (
                  <p className="text-sm text-slate-500">{compraDetalleQuery.data.observacion}</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Producto</th>
                        <th className="px-4 py-3 text-left">Cantidad</th>
                        <th className="px-4 py-3 text-left">Costo unitario</th>
                        <th className="px-4 py-3 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {compraDetalleQuery.data.producto_compra.map((item: ProductoCompraItem) => (
                        <tr key={item.id_producto_compra}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{item.producto.nombre_producto}</p>
                            <p className="text-xs text-slate-500">{item.producto.codigo_producto}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.cantidad_compra}</td>
                          <td className="px-4 py-3 text-slate-700">{currency.format(item.costo_unitario)}</td>
                          <td className="px-4 py-3 text-slate-900 font-semibold">{currency.format(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{currency.format(compraDetalleQuery.data.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>IVA (15 %)</span>
                  <span>{currency.format(compraDetalleQuery.data.impuesto)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{currency.format(compraDetalleQuery.data.total)}</span>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      <ComprasFiltersDrawer
        open={filtersOpen}
        onOpenChange={(open) => {
				if (!open) {
					cancelFilters()
					return
				}
				setFiltersOpen(true)
			}}
			filtersDraft={filtersDraft}
			setFiltersDraft={setFiltersDraft}
			proveedores={proveedores}
			onApply={applyDraft}
			onCancel={cancelFilters}
			onClearDraft={clearDraft}
      />

      <ComprasDetailDrawer
        open={detailId !== null}
        compra={compraDetalleQuery.data ?? null}
        dateFormatter={dateFormatter}
        onEdit={() => {
          // TODO: Implementar edición
        }}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
