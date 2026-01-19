"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, DollarSign, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { creditsApi } from "../../services/creditsApi"
import { formatMoney } from "../../utils/number"
import { ProductsListHeader } from "../products/components/ProductsListHeader"
import PaginationFooter from "../../components/common/PaginationFooter"
import CuotasFiltersDrawer, { type CuotasFilters } from "./components/CuotasFiltersDrawer"

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 20

const installmentStatusClasses: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  VENCIDA: "bg-red-100 text-red-800",
  PAGADA: "bg-emerald-100 text-emerald-800",
}

type Installment = {
  id: number
  number: number
  dueDate?: string
  amount: number
  paidAmount: number
  status: string
  clienteLabel?: string
  creditoLabel?: string
  creditId?: number
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(d)
}

export default function CuotasPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [filters, setFilters] = useState<CuotasFilters>({ status: "all", dateFrom: null, dateTo: null, orden: "date_asc" })
  const [filtersDraft, setFiltersDraft] = useState<CuotasFilters>(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportingKey, setExportingKey] = useState<string | null>(null)

  const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
    try {
      const raw = window.localStorage.getItem("cuotas.pageSize")
      const parsed = Number(raw)
      return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE
    } catch {
      return DEFAULT_PAGE_SIZE
    }
  })
  const [currentPage, setCurrentPage] = useState(1)

  const creditsQuery = useQuery({ queryKey: ["creditos"], queryFn: () => creditsApi.getCredits(), enabled: isAdmin })
  const creditIds = useMemo(() => (creditsQuery.data ?? []).map((c) => c.id), [creditsQuery.data])

  const installmentsQuery = useQuery({
    queryKey: ["cuotas", "all", creditIds],
    enabled: isAdmin && creditIds.length > 0,
    queryFn: async () => {
      const details = await Promise.all(creditIds.map((id) => creditsApi.getCreditById(id)))
      const rows: Installment[] = []
      for (const d of details) {
        const clienteLabel = `${d.cliente.nombres} ${d.cliente.apellidos}`
        const creditoLabel = d.saleCode || `Crédito #${d.id}`
        for (const cuota of d.installments) {
          rows.push({ ...(cuota as unknown as Installment), creditId: d.id, clienteLabel, creditoLabel })
        }
      }
      // orden por fecha asc
      rows.sort((a, b) => {
        const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0
        const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0
        return ta - tb
      })
      return rows
    },
  })

  const installments = useMemo(() => installmentsQuery.data ?? [], [installmentsQuery.data]) as Installment[]

  const normalizedSearch = searchInput.trim().toLowerCase()

  const filtered = useMemo(() => {
    return installments.filter((r: Installment) => {
      if (filters.status !== "all" && r.status !== filters.status) return false
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom)
        if (!r.dueDate) return false
        if (new Date(r.dueDate) < from) return false
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo)
        // include day
        to.setHours(23, 59, 59, 999)
        if (!r.dueDate) return false
        if (new Date(r.dueDate) > to) return false
      }

      if (!normalizedSearch) return true
      const cliente = (r.clienteLabel ?? "").toLowerCase()
      const credito = (r.creditoLabel ?? "").toLowerCase()
      return cliente.includes(normalizedSearch) || credito.includes(normalizedSearch) || String(r.number).includes(normalizedSearch)
    })

    // aplicar orden
    filtered.sort((a, b) => {
      switch (filters.orden) {
        case "date_asc":
          return (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0)
        case "date_desc":
          return (b.dueDate ? new Date(b.dueDate).getTime() : 0) - (a.dueDate ? new Date(a.dueDate).getTime() : 0)
        case "amount_asc":
          return (a.amount ?? 0) - (b.amount ?? 0)
        case "amount_desc":
          return (b.amount ?? 0) - (a.amount ?? 0)
        default:
          return 0
      }
    })
  }, [installments, filters, normalizedSearch])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [totalPages, currentPage])

  useEffect(() => {
    try {
      window.localStorage.setItem("cuotas.pageSize", String(pageSize))
    } catch {
      /* ignore localStorage errors */
    }
  }, [pageSize])

  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  const [detailId, setDetailId] = useState<number | null>(null)
  const detailQuery = useQuery({ queryKey: ["credito", detailId], queryFn: () => creditsApi.getCreditById(detailId as number), enabled: detailId !== null })

  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const pagarMutation = useMutation<void, unknown, { installmentId: number; amount: number }>({
    mutationFn: async ({ installmentId, amount }: { installmentId: number; amount: number }) => {
      await creditsApi.payInstallment(installmentId, { amount })
      return
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cuotas"] })
      await queryClient.invalidateQueries({ queryKey: ["creditos"] })
      setPagoDialogOpen(false)
      setSelectedInstallment(null)
    },
    onError: () => toast.error("No se pudo registrar el pago."),
  })

  const exportMutation = useMutation({
    mutationFn: async (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv" }) => {
      const key = `${args.scope}-${args.format}`
      setExportingKey(key)
      try {
        if (args.scope === "all") {
          await creditsApi.exportCredits({ scope: "all", format: args.format })
          return
        }
        const creditIdsOnPage = pageRows.map((r: Installment) => r.creditId)
        const ids = Array.from(new Set(creditIdsOnPage)).filter((id): id is number => typeof id === "number")
        await creditsApi.exportCredits({ scope: "page", format: args.format, ids })
      } finally {
        setExportingKey(null)
      }
    },
  })

  const exportSinglePdfMutation = useMutation({
    mutationFn: async (creditId: number) => {
      setExportingKey(`single-${creditId}`)
      try {
        await creditsApi.exportSingleCreditPdf(creditId)
      } finally {
        setExportingKey(null)
      }
    },
    onError: () => toast.error("No se pudo exportar el crédito."),
  })

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <div className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden ver esta vista.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="cuotas-encabezado" className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p id="cuotas-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">CUOTAS</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Cuotas</h1>
            <p className="mt-1 text-sm text-slate-500">Listado de cuotas, pagos y vencimientos.</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
            <button
              type="button"
              onClick={() => setPagoDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4" />
              Registrar pago
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="cuotas-resumen" className="space-y-3">
        <div className="flex items-center justify-between">
          <p id="cuotas-resumen" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase text-slate-500">Total cuotas</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{installments.length}</p>
            <p className="text-sm text-slate-500">Registradas</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase text-slate-500">Cuotas pendientes</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">{installments.filter((i: Installment) => i.status === "PENDIENTE").length}</p>
            <p className="text-sm text-slate-500">Por cobrar</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase text-slate-500">Cuotas pagadas</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{installments.filter((i: Installment) => i.status === "PAGADA").length}</p>
            <p className="text-sm text-slate-500">Registradas</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase text-slate-500">Cuotas vencidas</p>
            <p className="mt-2 text-3xl font-semibold text-red-600">{installments.filter((i: Installment) => i.status === "VENCIDA").length}</p>
            <p className="text-sm text-slate-500">Requieren atención</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <ProductsListHeader
          startItem={totalItems === 0 ? 0 : 1}
          endItem={totalItems}
          resultsCount={totalItems}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onOpenFilters={() => {
            setFiltersDraft(filters)
            setFiltersOpen(true)
          }}
          onExport={(args) => exportMutation.mutate(args)}
          exportingKey={exportingKey}
          filterChips={[]}
          onRemoveChip={() => {}}
          onClearAllFilters={() => setFilters({ status: "all", dateFrom: null, dateTo: null })}
        />

        <div className="px-6 pb-6">
          {installmentsQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando cuotas...
            </div>
          )}

          {!installmentsQuery.isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">No hay cuotas que mostrar.</div>
          )}

          {!installmentsQuery.isLoading && filtered.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Nº Cuota</th>
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Crédito</th>
                    <th className="px-6 py-3">Fecha de vencimiento</th>
                    <th className="px-6 py-3">Monto</th>
                    <th className="px-6 py-3">Saldo</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pageRows.map((row: Installment) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">#{row.number}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.clienteLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.creditoLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{formatDate(row.dueDate)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{formatMoney(row.amount)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{formatMoney(Math.max(row.amount - row.paidAmount, 0))}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${installmentStatusClasses[row.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDetailId(row.creditId ?? null)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            aria-label="Ver crédito"
                            title="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedInstallment(row)
                              setPagoDialogOpen(true)
                            }}
                            disabled={row.status === "PAGADA"}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Registrar pago"
                            title={row.status === "PAGADA" ? "Ya pagada" : "Registrar pago"}
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => { if (typeof row.creditId === "number") exportSinglePdfMutation.mutate(row.creditId) }}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            aria-label="Exportar PDF"
                            title="Exportar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onPageSizeChange={(next) => {
            setPageSize(next as PageSizeOption)
            setCurrentPage(1)
          }}
        />
      </section>

      <CuotasFiltersDrawer
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
        onClearDraft={() => setFiltersDraft({ status: "all", dateFrom: null, dateTo: null })}
      />

      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de crédito</DialogTitle>
            <DialogDescription>Información del crédito y sus cuotas.</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <div className="p-4 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}
          {detailQuery.data && (
            <div className="space-y-4 px-4 pb-6">
              <p className="font-semibold">{detailQuery.data.saleCode || `Crédito #${detailQuery.data.id}`}</p>
              <p className="text-sm text-slate-500">Cliente: {detailQuery.data.cliente.nombres} {detailQuery.data.cliente.apellidos}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Cuota</th>
                      <th className="px-4 py-3 text-left">Vencimiento</th>
                      <th className="px-4 py-3 text-left">Monto</th>
                      <th className="px-4 py-3 text-left">Saldo</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detailQuery.data.installments.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">#{c.number}</td>
                        <td className="px-4 py-3">{formatDate(c.dueDate)}</td>
                        <td className="px-4 py-3 font-semibold">{formatMoney(c.amount)}</td>
                        <td className="px-4 py-3 font-semibold">{formatMoney(Math.max(c.amount - c.paidAmount, 0))}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${installmentStatusClasses[c.status] ?? "bg-slate-100 text-slate-700"}`}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pagoDialogOpen && !!selectedInstallment} onOpenChange={(open) => { if (!open) { setPagoDialogOpen(false); setSelectedInstallment(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Registra el pago de la cuota seleccionada.</DialogDescription>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedInstallment.creditoLabel}</p>
                <p className="text-xs text-slate-500">Cuota #{selectedInstallment.number}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Monto original</span>
                  <strong>{formatMoney(selectedInstallment.amount)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Saldo pendiente</span>
                  <strong className="text-emerald-700">{formatMoney(Math.max(selectedInstallment.amount - selectedInstallment.paidAmount, 0))}</strong>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); pagarMutation.mutate({ installmentId: selectedInstallment.id, amount: Math.max(selectedInstallment.amount - selectedInstallment.paidAmount, 0) }) }} className="space-y-4">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setPagoDialogOpen(false); setSelectedInstallment(null) }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" disabled={pagarMutation.status === "pending"} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{pagarMutation.status === "pending" && <Loader2 className="h-4 w-4 animate-spin"/>} Registrar pago</button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
