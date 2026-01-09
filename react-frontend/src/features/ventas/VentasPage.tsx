"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertCircle,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  XOctagon,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { httpRequest } from "../../services/httpClient"
import { salesService, type FormaPago, type VentaDetailRecord, type VentaListRecord } from "../../services/salesService"
import { formatMoney, round2, toNumberSafe } from "../../utils/number"
import { SalesDetailDrawer } from "./components/SalesDetailDrawer"
import { SalesFiltersDrawer, type SalesFilters } from "./components/SalesFiltersDrawer"
import { SalesListHeader } from "./components/SalesListHeader"
import { SaleCreateModal } from "./components/SaleCreateModal"
import type { ClienteOption, ProductoOption } from "./types"

// Todas las fechas de facturas se leen igual desde la tabla y el modal.
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
})

const formaPagoLabels: Record<FormaPago, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
}

const formaPagoStyles: Record<FormaPago, string> = {
  CONTADO: "bg-slate-100 text-slate-700",
  CREDITO: "bg-purple-50 text-purple-700",
}

// Cada petición muestra el mensaje nativo del backend antes de caer en genérico.
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

const formatDateSafe = (value: string | null | undefined) => {
  if (!value) return "—"
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return dateFormatter.format(date)
  } catch {
    return "—"
  }
}

const PAGE_SIZE_STORAGE_KEY = "sales.pageSize"
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 20

export default function VentasPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [detailFormError, setDetailFormError] = useState<string | null>(null)
  const [editObservacionDraft, setEditObservacionDraft] = useState("")

  const closeEditDialog = () => {
    setEditId(null)
    setEditObservacionDraft("")
    setDetailFormError(null)
  }

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<SalesFilters>({ estado: "all", formaPago: "all", fechaDesde: "", fechaHasta: "" })
  const [filtersDraft, setFiltersDraft] = useState<SalesFilters>(filters)
  const [searchInput, setSearchInput] = useState("")

  const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
    const parsed = stored ? Number(stored) : DEFAULT_PAGE_SIZE
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE
  })
  const [page, setPage] = useState(1)

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize))
  }, [pageSize])

  useEffect(() => {
    setPage(1)
  }, [pageSize, searchInput, filters])

  // Cierra el menú de acciones (⋯) al hacer click fuera.
  useEffect(() => {
    const handlePointerDownCapture = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-sales-actions-menu]")) return
      document.querySelectorAll<HTMLDetailsElement>("[data-sales-actions-menu][open]").forEach((node) => {
        node.open = false
      })
    }

    document.addEventListener("pointerdown", handlePointerDownCapture, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownCapture, true)
    }
  }, [])

  
  // Tabla principal: trae las ventas más recientes para admins.
  const ventasQuery = useQuery<VentaListRecord[]>({
    queryKey: ["ventas"],
    enabled: isAdmin,
    queryFn: async () => {
      return await salesService.listSales()
    },
  })

  // KPI: créditos pendientes (monto + cantidad). No modifica backend.
  const creditosKpiQuery = useQuery<{ saldo_pendiente: number }[]>({
    queryKey: ["creditos", "kpi"],
    enabled: isAdmin,
    queryFn: async () => {
      const data = await httpRequest<unknown>("/credito")
      if (!Array.isArray(data)) return []
      return (data as unknown[]).map((item) => {
        const record = (item ?? {}) as Record<string, unknown>
        return {
          saldo_pendiente: toNumberSafe(record.saldo_pendiente),
        }
      })
    },
  })

  // Combo de clientes: se usa en el formulario de creación.
  const clientesQuery = useQuery<ClienteOption[]>({
    queryKey: ["clientes"],
    enabled: isAdmin,
    queryFn: async () => {
      const data = await httpRequest<ClienteOption[]>("/cliente")
      return Array.isArray(data) ? data : []
    },
  })

  // Inventario resumido para autocompletar cada detalle.
  const productosQuery = useQuery<ProductoOption[]>({
    queryKey: ["productos-catalogo"],
    enabled: isAdmin,
    queryFn: async () => {
      const data = await httpRequest<unknown>("/producto")
      if (!Array.isArray(data)) return []
      return (data as unknown[]).map((item) => {
        const record = (item ?? {}) as Record<string, unknown>
        return {
          id_producto: toNumberSafe(record.id_producto),
          nombre_producto: String(record.nombre_producto ?? ""),
          codigo_producto: String(record.codigo_producto ?? ""),
          precio_venta: toNumberSafe(record.precio_venta),
          cantidad_stock: toNumberSafe(record.cantidad_stock),
          stock_minimo: toNumberSafe(record.stock_minimo),
        }
      })
    },
  })

  // Modal de detalle: reutiliza el mismo id_factura para mostrar creditos/cuotas.
  const ventaDetalleQuery = useQuery<VentaDetailRecord>({
    queryKey: ["venta", detailId],
    enabled: detailId !== null,
    queryFn: async () => {
      return await salesService.getSale(detailId as number)
    },
  })

  const ventaEditarQuery = useQuery<VentaDetailRecord>({
    queryKey: ["venta", "edit", editId],
    enabled: editId !== null,
    queryFn: async () => {
      return await salesService.getSale(editId as number)
    },
  })

  // Cuando abrimos un modal de edición cargamos observación.
  useEffect(() => {
    if (ventaEditarQuery.data) {
      setEditObservacionDraft(ventaEditarQuery.data.observacion ?? "")
      setDetailFormError(null)
    }
  }, [ventaEditarQuery.data])

  // Permite editar sólo la observación sin reabrir la venta.
  const updateObservacionMutation = useMutation({
    mutationFn: ({ id, observacion }: { id: number; observacion: string | null }) =>
      salesService.updateSale(id, { observacion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["venta", detailId] })
      }
      if (editId) {
        queryClient.invalidateQueries({ queryKey: ["venta", "edit", editId] })
      }
      setDetailFormError(null)
      toast.success("Observaciones actualizadas")
      closeEditDialog()
    },
    onError: (error: unknown) => {
      setDetailFormError(getApiErrorMessage(error, "No se pudo guardar la observación"))
      toast.error("Error al guardar")
    },
  })

  // Anular una factura hace DELETE y refresca tanto la tabla como el modal.
  const cancelVentaMutation = useMutation({
    mutationFn: (id: number) => salesService.cancelSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["venta", detailId] })
      }
      setDetailFormError(null)
      toast.success("Venta anulada")
    },
    onError: (error: unknown) => {
      setDetailFormError(getApiErrorMessage(error, "No se pudo anular la venta"))
      toast.error("No se pudo anular")
    },
  })

  const reactivateVentaMutation = useMutation({
    mutationFn: (id: number) => salesService.reactivateSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["venta", detailId] })
      }
      setDetailFormError(null)
      toast.success("Venta reactivada")
    },
    onError: (error: unknown) => {
      setDetailFormError(getApiErrorMessage(error, "No se pudo reactivar la venta"))
      toast.error("No se pudo reactivar")
    },
  })

  const ventas = useMemo(() => ventasQuery.data ?? [], [ventasQuery.data])
  const clientes = useMemo(() => clientesQuery.data ?? [], [clientesQuery.data])
  const productos = useMemo(() => productosQuery.data ?? [], [productosQuery.data])

  // KPIs rápidos para pintar las tarjetas del dashboard.
  const totalFacturado = useMemo(() => round2(ventas.reduce((acc, venta) => acc + toNumberSafe(venta.total), 0)), [ventas])

  const creditVentas = useMemo(() => ventas.filter((venta) => venta.forma_pago === "CREDITO"), [ventas])
  const creditShare = ventas.length ? Math.round((creditVentas.length / ventas.length) * 100) : 0
  const promedioTicket = ventas.length ? round2(totalFacturado / ventas.length) : 0

  const creditosPendientes = useMemo(() => {
    const creditos = creditosKpiQuery.data ?? []
    return creditos.filter((credito) => credito.saldo_pendiente > 0.05)
  }, [creditosKpiQuery.data])
  const creditosPendientesCount = creditosPendientes.length
  const creditosPendientesMonto = useMemo(
    () => round2(creditosPendientes.reduce((acc, credito) => acc + credito.saldo_pendiente, 0)),
    [creditosPendientes]
  )

  const filteredVentas = useMemo(() => {
    const needle = searchInput.trim().toLowerCase()
    const desdeMs = filters.fechaDesde ? new Date(filters.fechaDesde).getTime() : null
    const hastaMs = filters.fechaHasta ? new Date(filters.fechaHasta).getTime() : null

    return ventas.filter((venta) => {
      const isAnulada = venta.id_estado !== 1
      if (filters.estado === "ACTIVA" && isAnulada) return false
      if (filters.estado === "ANULADA" && !isAnulada) return false

      if (filters.formaPago !== "all" && venta.forma_pago !== filters.formaPago) return false

      const fechaMs = venta.fecha_factura ? new Date(venta.fecha_factura).getTime() : NaN
      if (desdeMs !== null && Number.isFinite(fechaMs) && fechaMs < desdeMs) return false
      if (hastaMs !== null && Number.isFinite(fechaMs)) {
        const endOfDay = hastaMs + 24 * 60 * 60 * 1000 - 1
        if (fechaMs > endOfDay) return false
      }

      if (!needle) return true
      const factura = (venta.numero_factura ?? "").toLowerCase()
      const clienteNombre = venta.cliente ? `${venta.cliente.nombres} ${venta.cliente.apellidos}`.toLowerCase() : ""
      const cedula = (venta.cliente?.cedula ?? "").toLowerCase()
      return factura.includes(needle) || clienteNombre.includes(needle) || cedula.includes(needle)
    })
  }, [ventas, searchInput, filters])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredVentas.length / pageSize)), [filteredVentas.length, pageSize])
  const currentPage = Math.min(page, totalPages)
  const pagedVentas = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredVentas.slice(start, start + pageSize)
  }, [filteredVentas, currentPage, pageSize])

  const startItem = filteredVentas.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = filteredVentas.length === 0 ? 0 : Math.min(filteredVentas.length, (currentPage - 1) * pageSize + pagedVentas.length)

  const handleCancelVenta = () => {
    if (!ventaDetalleQuery.data || cancelVentaMutation.isPending) return
    const confirmed = window.confirm("¿Seguro que deseas anular esta venta? Esta acción no se puede revertir.")
    if (!confirmed) return
    cancelVentaMutation.mutate(ventaDetalleQuery.data.id_factura)
  }

  const handleReactivateVenta = () => {
    if (!ventaDetalleQuery.data || reactivateVentaMutation.isPending) return
    const confirmed = window.confirm("¿Reactivar esta venta? Se validará stock disponible.")
    if (!confirmed) return
    reactivateVentaMutation.mutate(ventaDetalleQuery.data.id_factura)
  }

  const filterChips = useMemo(() => {
    const chips: { key: "estado" | "formaPago" | "fecha"; label: string }[] = []
    if (filters.formaPago !== "all") chips.push({ key: "formaPago", label: `Forma de pago: ${filters.formaPago === "CREDITO" ? "Crédito" : "Contado"}` })
    if (filters.estado !== "all") chips.push({ key: "estado", label: `Estado: ${filters.estado === "ACTIVA" ? "Activa" : "Anulada"}` })
    if (filters.fechaDesde || filters.fechaHasta) {
      chips.push({ key: "fecha", label: `Fecha: ${filters.fechaDesde || "…"} - ${filters.fechaHasta || "…"}` })
    }
    return chips
  }, [filters])

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar ventas.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="ventas-encabezado"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p id="ventas-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              FACTURACIÓN
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Ventas</h1>
            <p className="mt-1 text-sm text-slate-500">Controla facturas, observaciones y ventas a crédito en un solo panel.</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              disabled={!isAdmin}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Nueva venta"
            >
              <Plus className="h-4 w-4" />
              Nueva venta
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase text-slate-500">Ventas registradas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{ventas.length}</p>
          <p className="text-sm text-slate-500">Cabeceras totales en el sistema</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Total facturado</p>
            <BadgeDollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatMoney(totalFacturado)}</p>
          <p className="text-sm text-slate-500">Incluye IVA</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Créditos</p>
            <CreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-purple-700">{creditShare}%</p>
          <p className="text-sm text-slate-500">De las ventas son a crédito</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Ticket promedio</p>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatMoney(promedioTicket)}</p>
          <p className="text-sm text-slate-500">Total / ventas registradas</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Créditos pendientes</p>
            <CalendarClock className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-purple-700">
            {creditosKpiQuery.isLoading ? "—" : formatMoney(creditosPendientesMonto)}
          </p>
          <p className="text-sm text-slate-500">
            {creditosKpiQuery.isLoading
              ? "Cargando saldo pendiente…"
              : `${creditosPendientesCount} crédito${creditosPendientesCount === 1 ? "" : "s"} con saldo > 0`}
          </p>
        </article>
      </section>

      {ventasQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Error al cargar ventas. Intenta nuevamente.
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
          <SalesListHeader
            startItem={startItem}
            endItem={endItem}
            resultsCount={filteredVentas.length}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onOpenFilters={() => {
              setFiltersDraft(filters)
              setFiltersOpen(true)
            }}
            filterChips={filterChips}
            onRemoveChip={(key) => {
              if (key === "estado") setFilters((prev) => ({ ...prev, estado: "all" }))
              if (key === "formaPago") setFilters((prev) => ({ ...prev, formaPago: "all" }))
              if (key === "fecha") setFilters((prev) => ({ ...prev, fechaDesde: "", fechaHasta: "" }))
            }}
            onClearAllFilters={() => {
              setFilters({ estado: "all", formaPago: "all", fechaDesde: "", fechaHasta: "" })
              setSearchInput("")
            }}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Totales</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pago / Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {pagedVentas.map((venta) => {
                  const isAnulada = venta.id_estado !== 1
                  const canReactivate = isAnulada && venta.forma_pago === "CONTADO"
                  return (
                    <tr key={venta.id_factura} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900">{venta.numero_factura}</p>
                        <p className="text-xs text-slate-500">{formatDateSafe(venta.fecha_factura)}</p>
                        {venta.observacion && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{venta.observacion}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          {venta.cliente ? `${venta.cliente.nombres} ${venta.cliente.apellidos}` : "Cliente no disponible"}
                        </p>
                        <p className="text-xs text-slate-500">{venta.cliente?.cedula ?? "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <BadgeDollarSign className="h-4 w-4 text-slate-400" />
                          {formatMoney(venta.total)}
                        </div>
                        <p className="text-xs text-slate-500">
                          Subtotal {formatMoney(venta.subtotal)} · IVA {formatMoney(venta.impuesto)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isAnulada ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isAnulada ? "Anulada" : "Activa"}
                        </span>
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${formaPagoStyles[venta.forma_pago]}`}
                          >
                            {formaPagoLabels[venta.forma_pago]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailId(venta.id_factura)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          aria-label={`Ver venta ${venta.numero_factura}`}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <details className="relative inline-block text-left" data-sales-actions-menu>
                          <summary
                            className="inline-flex h-10 w-10 list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            aria-label={`Más acciones para ${venta.numero_factura}`}
                            onClick={(event) => {
                              // Evita que el click seleccione texto en algunas tablas.
                              event.stopPropagation()
                            }}
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </summary>
                          <div
                            className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
                            onClick={(event) => {
                              // Cierra el menú al elegir una acción.
                              const details = (event.currentTarget.parentElement ?? null) as HTMLDetailsElement | null
                              if (details) details.open = false
                            }}
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (isAnulada) return
                                setEditId(venta.id_factura)
                              }}
                              disabled={isAnulada}
                              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title={isAnulada ? "No se puede editar una venta anulada" : "Editar observaciones"}
                            >
                              Editar observaciones
                            </button>

                            {isAnulada ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (!canReactivate || reactivateVentaMutation.isPending) return
                                  const confirmed = window.confirm("¿Reactivar esta venta? Se validará stock disponible.")
                                  if (!confirmed) return
                                  reactivateVentaMutation.mutate(venta.id_factura)
                                }}
                                disabled={!canReactivate || reactivateVentaMutation.isPending}
                                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title={canReactivate ? "Reactivar venta (solo contado)" : "Reactivar no disponible para créditos"}
                              >
                                Reactivar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (cancelVentaMutation.isPending) return
                                  const confirmed = window.confirm(
                                    "¿Seguro que deseas anular esta venta? Esta acción no se puede revertir."
                                  )
                                  if (!confirmed) return
                                  cancelVentaMutation.mutate(venta.id_factura)
                                }}
                                disabled={cancelVentaMutation.isPending}
                                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <XOctagon className="h-3.5 w-3.5" /> Anular
                                </span>
                              </button>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {ventasQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ventas...
            </div>
          )}

          {!ventasQuery.isLoading && filteredVentas.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <ReceiptText size={36} className="mx-auto mb-2 opacity-50" />
              {searchInput.trim() || filterChips.length ? "Sin resultados para los filtros actuales." : "Aún no registras ventas."}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5">
            <div className="text-sm font-medium text-slate-600">Página {currentPage} de {totalPages}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Siguiente
              </button>
            </div>

            <div className="inline-flex items-center gap-3">
              <label htmlFor="sales-page-size-bottom" className="text-sm font-semibold text-slate-800">
                Por página
              </label>
              <select
                id="sales-page-size-bottom"
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSizeOption)}
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
      </div>

        <SalesFiltersDrawer
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filtersDraft={filtersDraft}
          setFiltersDraft={setFiltersDraft}
          onApply={() => {
            setFilters(filtersDraft)
            setFiltersOpen(false)
          }}
          onCancel={() => {
            setFiltersDraft(filters)
            setFiltersOpen(false)
          }}
          onClearDraft={() => setFiltersDraft({ estado: "all", formaPago: "all", fechaDesde: "", fechaHasta: "" })}
        />

      <SaleCreateModal
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clientes={clientes}
        productos={productos}
        clientesLoading={clientesQuery.isLoading}
        productosLoading={productosQuery.isLoading}
        isAdmin={isAdmin}
      />

      <SalesDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setDetailFormError(null)
          }
        }}
        sale={ventaDetalleQuery.data ?? null}
        isLoading={ventaDetalleQuery.isLoading}
        isError={ventaDetalleQuery.isError}
        dateFormatter={dateFormatter}
        onEdit={() => {
          if (!ventaDetalleQuery.data) return
          setEditId(ventaDetalleQuery.data.id_factura)
          setDetailId(null)
        }}
        onCancel={handleCancelVenta}
        onReactivate={handleReactivateVenta}
        onClose={() => {
          setDetailId(null)
          setDetailFormError(null)
        }}
        supportsReactivate={(ventaDetalleQuery.data?.forma_pago ?? "CONTADO") === "CONTADO"}
        busy={cancelVentaMutation.isPending || reactivateVentaMutation.isPending}
        errorMessage={detailFormError}
      />

      <Dialog
        open={editId !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog()
          }
        }}
      >
        <DialogContent
          className="dialog-content flex h-[85vh] w-[80vw] max-w-5xl flex-col overflow-hidden p-0 max-sm:max-h-[90vh]"
          disableOutsideClose
          hideCloseButton
        >
          <DialogHeader className="border-b border-slate-200 px-8 py-6">
            <DialogTitle className="text-slate-900">Editar venta</DialogTitle>
            <DialogDescription className="text-slate-600">
              Por motivos de control y auditoría, solo se permite editar las observaciones.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-0 flex-col gap-6 px-8 py-6">
              {ventaEditarQuery.isLoading && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando venta...
                </div>
              )}

              {ventaEditarQuery.isError && !ventaEditarQuery.isLoading && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  No se pudo cargar la venta.
                </div>
              )}

              {ventaEditarQuery.data && (
                <div className="flex min-h-0 flex-1 flex-col gap-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Factura</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{ventaEditarQuery.data.numero_factura}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Fecha</p>
                          <p className="mt-1 text-sm text-slate-900">{formatDateSafe(ventaEditarQuery.data.fecha_factura)}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Cliente</p>
                          <p className="mt-1 text-sm text-slate-900">
                            {ventaEditarQuery.data.cliente
                              ? `${ventaEditarQuery.data.cliente.nombres} ${ventaEditarQuery.data.cliente.apellidos}`
                              : "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{ventaEditarQuery.data.cliente?.cedula ?? "—"}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                              (ventaEditarQuery.data.id_estado === 1
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-100 text-red-700")
                            }
                          >
                            {ventaEditarQuery.data.id_estado === 1 ? "Activa" : "Anulada"}
                          </span>
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
                              formaPagoStyles[ventaEditarQuery.data.forma_pago]
                            }
                          >
                            {formaPagoLabels[ventaEditarQuery.data.forma_pago]}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="text-slate-600">
                            Subtotal <span className="text-slate-900">{formatMoney(toNumberSafe(ventaEditarQuery.data.subtotal))}</span>
                          </p>
                          <p className="text-slate-600">
                            IVA <span className="text-slate-900">{formatMoney(toNumberSafe(ventaEditarQuery.data.impuesto))}</span>
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Total</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {formatMoney(toNumberSafe(ventaEditarQuery.data.total))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {ventaEditarQuery.data.id_estado !== 1 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Esta venta está anulada. Por control administrativo no se permite editar observaciones.
                    </div>
                  )}

                  <div className="flex min-h-0 flex-1 flex-col">
                    <label className="text-xs font-semibold uppercase text-slate-800">Observaciones</label>
                    <textarea
                      value={editObservacionDraft}
                      onChange={(event) => setEditObservacionDraft(event.target.value)}
                      maxLength={255}
                      placeholder="Ej. Corrección administrativa registrada; motivo, autorización y cualquier nota relevante para auditoría."
                      className="mt-2 min-h-[260px] w-full flex-1 resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 lg:min-h-[40vh]"
                      disabled={ventaEditarQuery.data.id_estado !== 1}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>Máximo 255 caracteres</span>
                      <span>{editObservacionDraft.length}/255</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-8 py-4">
            {detailFormError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{detailFormError}</div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditDialog}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!ventaEditarQuery.data) return
                  updateObservacionMutation.mutate({
                    id: ventaEditarQuery.data.id_factura,
                    observacion: editObservacionDraft.trim() ? editObservacionDraft.trim() : null,
                  })
                }}
                disabled={
                  !ventaEditarQuery.data ||
                  ventaEditarQuery.data.id_estado !== 1 ||
                  updateObservacionMutation.isPending ||
                  editObservacionDraft.trim() === (ventaEditarQuery.data.observacion ?? "").trim()
                }
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateObservacionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}