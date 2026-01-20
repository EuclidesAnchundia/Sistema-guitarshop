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
import { toast } from "sonner"

import { api } from "../../lib/apiClient"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { ComprasListHeader } from "./components/ComprasListHeader"
import type { ComprasFilterChip } from "./components/ComprasListHeader"
import { ComprasFiltersDrawer, type ComprasFiltersDraft } from "./components/ComprasFiltersDrawer"
import { ComprasDetailDrawer } from "./components/ComprasDetailDrawer"
import ProviderSearchAutocomplete from "../products/components/ProviderSearchAutocomplete"
import CompraProductSearchAutocomplete from "./components/CompraProductSearchAutocomplete"
import CompraCartTable from "./components/CompraCartTable"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog"

import type { CompraDetailRecord, CompraListRecord } from "./compra.types"
import { compraClient } from "./compra.client"
import { useComprasQuery } from "./useComprasQuery"
// removed unused ExportRow import

type ProveedorOption = {
  id_proveedor: number
  nombre_proveedor: string
}

type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  precio_compra?: number
  cantidad_stock?: number
  costo?: number
}

const PAGE_SIZE_STORAGE_KEY = "compras.pageSize"
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 20

const defaultFiltersDraft: ComprasFiltersDraft = {
  orden: "date_desc",
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
  aplicar_iva: z.boolean().optional(),
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
  detalle: [],
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
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editId, setEditId] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

	const [exportingKey, setExportingKey] = useState<string | null>(null)

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
    mode: "onChange",
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
      const { data } = await api.get<ProductoOption[]>('/producto')
      if (!Array.isArray(data)) return []
      type Incoming = Partial<{ id_producto: number; nombre_producto: string; codigo_producto: string; precio_compra: number; costo: number; cantidad_stock: number; stock: number }>
      return data.map((item: Incoming) => {
        const precio_compra = typeof item.precio_compra === 'number' ? item.precio_compra : (typeof item.costo === 'number' ? item.costo : 0)
        const cantidad_stock = typeof item.cantidad_stock === 'number' ? item.cantidad_stock : (typeof item.stock === 'number' ? item.stock : undefined)
        return {
          id_producto: item.id_producto ?? 0,
          nombre_producto: item.nombre_producto ?? '',
          codigo_producto: item.codigo_producto ?? '',
          precio_compra,
          cantidad_stock,
        }
      })
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

  const compraEditQuery = useQuery<CompraDetailRecord>({
    queryKey: ["compra", "edit", editId],
    enabled: editId !== null,
    queryFn: async () => {
      const { data } = await api.get<CompraDetailRecord>(`/compra/${editId}`)
      return data
    },
  })

  // Limpia todo cuando cerramos el modal principal.
  const closeDialog = () => {
    setDialogOpen(false)
    setDialogMode("create")
    setEditId(null)
    setFormError(null)
    form.reset(defaultValues)
  }

  // Abre el modal en blanco para la creación.
  const openCreate = () => {
    setFormError(null)
    setDialogMode("create")
    setEditId(null)
    form.reset(defaultValues)
    setDialogOpen(true)
  }

  const resetFormFromCompra = (compra: CompraDetailRecord) => {
    const detalle = Array.isArray(compra.producto_compra) && compra.producto_compra.length > 0
      ? compra.producto_compra.map((item) => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad_compra,
          costo_unitario: item.costo_unitario,
        }))
      : defaultValues.detalle

    form.reset({
      id_proveedor: compra.proveedor?.id_proveedor ?? 0,
      observacion: compra.observacion ?? "",
      detalle,
    })
  	void form.trigger()
  }

  const openEdit = (id: number, compra?: CompraDetailRecord | null) => {
    setFormError(null)
    setDialogMode("edit")
    setEditId(id)

    if (compra) {
      resetFormFromCompra(compra)
      setDialogOpen(true)
      return
    }

    // Evita mostrar valores previos mientras llega el fetch.
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

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompraPayload }) =>
      api.put(`/compra/${id}`, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["compras"] })
      queryClient.invalidateQueries({ queryKey: ["compra", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["compra", "edit", variables.id] })
      closeDialog()
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error, "No se pudo actualizar la compra"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/compra/${id}`).then(() => undefined),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["compras"] })
      if (detailId !== null && detailId === id) {
        setDetailId(null)
      }
      setDeleteId(null)
      setFormError(null)
    },
    onError: (error: unknown) => {
      // Mostramos el error en el mismo confirm.
      setFormError(getApiErrorMessage(error, "No se pudo eliminar la compra"))
    },
  })

  const exportMutation = useMutation({
    mutationFn: async (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv"; ids?: number[] }) => {
      const key = `${args.scope}-${args.format}`
      setExportingKey(key)
      try {
        await compraClient.exportCompras({
          scope: args.scope,
          format: args.format,
          ids: args.scope === "page" ? args.ids : undefined,
        })
      } finally {
        setExportingKey(null)
      }
    },
    onError: () => {
      toast.error("No se pudo exportar compras. Intenta nuevamente.")
    },
  })

  const exportSinglePdfMutation = useMutation({
    mutationFn: async (compraId: number) => {
      setExportingKey(`single-${compraId}`)
      try {
        await compraClient.exportSingleCompraPdf(compraId)
      } finally {
        setExportingKey(null)
      }
    },
    onError: () => {
      toast.error("No se pudo exportar la compra.")
    },
  })

  // Validaciones antes de submit y handler compartido para crear/editar.
  const validateBeforeSubmit = (values: CompraFormValues) => {
    // Proveedor obligatorio
    if (!values.id_proveedor || values.id_proveedor === 0) {
        form.setError("id_proveedor" as const, { type: "required", message: "Selecciona un proveedor" })
        setFormError("Selecciona un proveedor")
        toast.error("Selecciona un proveedor")
      return false
    }

    const detalle = Array.isArray(values.detalle) ? values.detalle : []
    if (detalle.length === 0) {
      toast.error("Agrega al menos 1 producto")
      form.setError("detalle" as const, { type: "required", message: "Agrega al menos un producto al detalle" })
      return false
    }

    // Recorremos líneas y validamos campos
    let anyValidProduct = false
    for (let i = 0; i < detalle.length; i++) {
      const line = detalle[i]
      if (!line || !line.id_producto || line.id_producto === 0) {
        form.setError(`detalle.${i}.id_producto` as const, { type: "required", message: "Selecciona un producto" })
        // no hacemos return inmediato para marcar todas las líneas inválidas
        continue
      }
      anyValidProduct = true

      if (!Number.isFinite(Number(line.cantidad)) || Number(line.cantidad) <= 0) {
        form.setError(`detalle.${i}.cantidad` as const, { type: "validate", message: "Cantidad mínima 1" })
        toast.error(`Cantidad mínima 1 en la línea ${i + 1}`)
        return false
      }

      if (!Number.isFinite(Number(line.costo_unitario)) || Number(line.costo_unitario) <= 0) {
        form.setError(`detalle.${i}.costo_unitario` as const, { type: "validate", message: "Costo inválido" })
        toast.error(`Costo inválido en la línea ${i + 1}`)
        return false
      }
    }

    if (!anyValidProduct) {
      toast.error("Agrega al menos un producto válido")
      return false
    }

    // Passed all validations
    setFormError(null)
    return true
  }

  const onSubmit = form.handleSubmit((values) => {
    // Validar antes de llamar a la API
    if (!validateBeforeSubmit(values)) return

    if (dialogMode === "edit") {
      if (editId === null) {
        setFormError("No se encontró la compra a editar")
        return
      }
      updateMutation.mutate({ id: editId, payload: buildPayload(values) })
      return
    }

    createMutation.mutate(buildPayload(values))
  })

  useEffect(() => {
    if (dialogMode !== "edit") return
    if (!dialogOpen) return
    if (!compraEditQuery.data) return
    resetFormFromCompra(compraEditQuery.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogMode, dialogOpen, compraEditQuery.data])

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
  const proveedores = useMemo(() => proveedoresQuery.data ?? [], [proveedoresQuery.data])
  const productos = useMemo(() => productosQuery.data ?? [], [productosQuery.data])

  const idProveedorWatch = form.watch("id_proveedor")
  const detalleValuesWatch = form.watch("detalle")

  const [providerInput, setProviderInput] = useState<string>(() => {
    const id = form.getValues("id_proveedor")
    const p = proveedores.find((x) => x.id_proveedor === id)
    return p?.nombre_proveedor ?? ""
  })

  useEffect(() => {
    const p = proveedores.find((x) => x.id_proveedor === idProveedorWatch)
    setProviderInput(p?.nombre_proveedor ?? "")
  }, [proveedores, idProveedorWatch])

  // visible input per detalle row
  const [, setSearchInputs] = useState<string[]>(() => {
    const det = (form.getValues("detalle") as DetalleCompra[]) || []
    return det.map((it) => {
      const prod = productos.find((p) => p.id_producto === it.id_producto)
      return prod?.nombre_producto ?? ""
    })
  })

  useEffect(() => {
    const det = form.getValues("detalle") || []
    setSearchInputs((prev) => {
      const next = [...prev]
      // adjust length
      while (next.length < det.length) next.push("")
      while (next.length > det.length) next.pop()
      // fill missing names from catalog
      for (let i = 0; i < det.length; i++) {
        if (!next[i]) {
          const prod = productos.find((p) => p.id_producto === det[i]?.id_producto)
          next[i] = prod?.nombre_producto ?? ""
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, detalleValuesWatch])

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

      // Aplicar ordenamiento
      filtered = filtered.slice()
      switch (filters.orden) {
        case "date_asc":
          filtered.sort((a, b) => (a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0) - (b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0))
          break
        case "date_desc":
          filtered.sort((a, b) => (b.fecha_compra ? new Date(b.fecha_compra).getTime() : 0) - (a.fecha_compra ? new Date(a.fecha_compra).getTime() : 0))
          break
        case "total_asc":
          filtered.sort((a, b) => (a.total ?? 0) - (b.total ?? 0))
          break
        case "total_desc":
          filtered.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
          break
        default:
          break
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
    const chips = [] as ComprasFilterChip[]
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
  const aplicarIva = form.watch("aplicar_iva")

  const totals = useMemo(() => {
    const items = Array.isArray(detalleValues) ? detalleValues : []
    let subtotal = 0
    items.forEach((item) => {
      if (item.cantidad && item.costo_unitario) {
        subtotal += item.cantidad * item.costo_unitario
      }
    })
    const impuesto = aplicarIva ? Number((subtotal * IVA_RATE).toFixed(2)) : 0
    const total = Number((subtotal + impuesto).toFixed(2))
    return { subtotal, impuesto, total }
  }, [detalleValues, aplicarIva])

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

  

  const CompraActionsMenu = ({ compra }: { compra: CompraListRecord }) => {
    const menu = useFloatingMenu()
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
                openEdit(compra.id_compra)
                menu.setOpen(false)
              }}
              className="flex w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setFormError(null)
                setDeleteId(compra.id_compra)
                menu.setOpen(false)
              }}
              className="flex w-full px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50"
            >
              Eliminar
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
		  onExport={(args) => {
			  if (exportMutation.isPending) return
			  if (args.scope === "all") {
				  exportMutation.mutate({ scope: "all", format: args.format })
				  return
			  }

			  const ids = paginatedCompras.map((c) => c.id_compra)
			  exportMutation.mutate({ scope: "page", format: args.format, ids })
		  }}
		  exportingKey={exportingKey}
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
          </div>
        )}

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
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          // Bloqueado por diseño: no cerrar por overlay/ESC.
          if (!next) return
          setDialogOpen(true)
        }}
      >
        <DialogContent className="dialog-content w-full max-w-6xl overflow-hidden p-0 sm:rounded-3xl" disableOutsideClose hideCloseButton>
          <div className="flex h-[95vh] flex-col">
            <DialogHeader className="border-b px-8 py-6 text-left flex-shrink-0">
              <DialogTitle className="text-2xl font-semibold text-slate-900">{dialogMode === "edit" ? "Editar compra" : "Registrar compra"}</DialogTitle>
              <p className="text-sm text-slate-600">{dialogMode === "edit" ? "Actualiza cabecera y productos asociados." : "Los movimientos actualizarán stock y kardex automáticamente."}</p>
            </DialogHeader>

            {formError && (
              <div className="mx-8 mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex-shrink-0">{formError}</div>
            )}

            <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Top bar: proveedor - empty - observacion (clonado de ventas) */}
                  <div className="border-b border-slate-200 bg-white px-8 py-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="text-xs font-medium uppercase text-slate-500">Proveedor</label>
                        <div className="mt-1">
                          <ProviderSearchAutocomplete
                            proveedores={proveedores}
                            value={providerInput}
                            onSelect={(prov) => {
                              if (prov) {
                                form.setValue("id_proveedor", prov.id_proveedor, { shouldValidate: true })
                                setProviderInput(prov.nombre_proveedor)
                              } else {
                                form.setValue("id_proveedor", 0, { shouldValidate: true })
                                setProviderInput("")
                              }
                            }}
                            disabled={proveedoresQuery.isLoading}
                          />
                          {form.formState.errors.id_proveedor && (
                            <p className="mt-1 text-xs text-red-600">{form.formState.errors.id_proveedor.message}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        {/* empty center column to match ventas layout */}
                      </div>

                      <div>
                        <label className="text-xs font-medium uppercase text-slate-500">Observaciones</label>
                        <input
                          type="text"
                          {...form.register("observacion")}
                          placeholder="Detalles adicionales (opcional)"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                    {/* Left panel */}
                    <div className="flex w-[70%] flex-col border-r border-slate-200 bg-white overflow-hidden">
                      <div className="border-b border-slate-200 px-8 py-6 flex-shrink-0">
                        <CompraProductSearchAutocomplete
                          productos={productos}
                          onSelect={(prod) => {
                            if (!prod) return
                            const det = form.getValues("detalle") as DetalleCompra[]
                            const idx = det.findIndex((d) => d.id_producto === prod.id_producto)
                            const suggestedCosto = prod.precio_compra ?? prod.costo ?? 0
                            if (idx >= 0) {
                              const current = det[idx]
                              form.setValue(`detalle.${idx}.cantidad`, (current.cantidad || 0) + 1, { shouldValidate: true })
                            } else {
                              detalleFieldArray.append({ id_producto: prod.id_producto, cantidad: 1, costo_unitario: suggestedCosto > 0 ? suggestedCosto : 0 })
                            }
                          }}
                          value=""
                          disabled={productosQuery.isLoading}
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto px-8 py-6">
                        <CompraCartTable
                          items={form.getValues("detalle") as DetalleCompra[]}
                          productosMap={new Map(productos.map((p) => [p.id_producto, p]))}
                          onIncrement={(index) => {
                            const det = form.getValues("detalle") as DetalleCompra[]
                            form.setValue(`detalle.${index}.cantidad`, (det[index].cantidad || 0) + 1, { shouldValidate: true })
                          }}
                          onDecrement={(index) => {
                            const det = form.getValues("detalle") as DetalleCompra[]
                            const next = Math.max(1, (det[index].cantidad || 1) - 1)
                            form.setValue(`detalle.${index}.cantidad`, next, { shouldValidate: true })
                          }}
                          onRemove={(index) => {
                            detalleFieldArray.remove(index)
                          }}
                          onCostoChange={(index, next) => {
                            form.setValue(`detalle.${index}.costo_unitario`, Number(next), { shouldValidate: true })
                          }}
                        />

                        {form.formState.errors.detalle?.message && (
                          <p className="mt-2 text-xs text-red-600">{form.formState.errors.detalle.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Right panel 30% */}
                    <div className="w-[30%]">
                      <div className="flex h-full flex-col min-h-0 border-l border-slate-200 bg-slate-50">
                        <div className="flex-1 p-4">
                          <h3 className="text-sm font-semibold text-slate-700 mb-4">Resumen</h3>

                          <div className="space-y-2.5 text-sm">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal</span>
                              <span className="tabular-nums font-medium">{currency.format(totals.subtotal)}</span>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" {...form.register("aplicar_iva")} className="h-4 w-4" />
                                <span className="text-xs uppercase">Aplicar IVA (15%)</span>
                              </label>
                              <span className="text-xs text-slate-500">{aplicarIva ? "Activado" : "Desactivado"}</span>
                            </div>

                            <div className="flex justify-between text-slate-600">
                              <span>IVA (15%)</span>
                              <span className="tabular-nums font-medium">{currency.format(totals.impuesto)}</span>
                            </div>

                            <div className="border-t border-slate-200 my-2"></div>
                            <div className="flex justify-between items-baseline text-slate-900">
                              <span className="text-base font-bold">Total</span>
                              <span className="text-2xl font-bold tabular-nums">{currency.format(totals.total)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-lg space-y-2">
                          <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending || (dialogMode === "edit" && compraEditQuery.isLoading) || !(form.formState.isValid)}
                            className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                          >
                            {(createMutation.isPending || updateMutation.isPending) ? (
                              <>
                                <svg className="h-5 w-5 animate-spin" />
                                Procesando...
                              </>
                            ) : (
                              <>Registrar compra</>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={closeDialog}
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="w-full h-10 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
          </div>
        </DialogContent>
      </Dialog>

      {detailId !== null && (
        <ComprasDetailDrawer
          open={detailId !== null}
          onOpenChange={(open) => {
            if (!open) setDetailId(null)
          }}
          compra={compraDetalleQuery.data ?? null}
          isLoading={compraDetalleQuery.isLoading}
          isError={compraDetalleQuery.isError}
          dateFormatter={dateFormatter}
          currency={currency}
          busy={exportingKey !== null || exportSinglePdfMutation.isPending}
          onExportPdf={() => {
            const compra = compraDetalleQuery.data
            if (!compra) return
            exportSinglePdfMutation.mutate(compra.id_compra)
          }}
          exportingPdf={exportSinglePdfMutation.isPending}
          onEdit={() => {
            const compra = compraDetalleQuery.data
            if (!compra) return
            openEdit(compra.id_compra, compra)
            setDetailId(null)
          }}
          onDelete={() => {
            const compra = compraDetalleQuery.data
            if (!compra) return
            setFormError(null)
            setDetailId(null)
            setDeleteId(compra.id_compra)
          }}
          onClose={() => setDetailId(null)}
        />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Eliminar compra</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esta acción no se puede deshacer. ¿Deseas eliminar la compra #{deleteId}?
            </p>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deleteMutation.isPending) return
                  setDeleteId(null)
                  setFormError(null)
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMutation.mutate(deleteId)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
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

    </div>
  )
}
