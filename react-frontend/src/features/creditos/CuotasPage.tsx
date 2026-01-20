"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, DollarSign, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "../../components/ui/drawer"
import { Dialog, DialogContent } from "../../components/ui/dialog"
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
  PENDIENTE: "bg-slate-100 text-slate-700",
  VENCIDA: "bg-slate-100 text-slate-700",
  PAGADA: "bg-slate-100 text-slate-700",
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
  const [confirmPayload, setConfirmPayload] = useState<{ amount: number } | null>(null)
  const pagarMutation = useMutation<void, unknown, { installmentId: number; amount: number; paidAt?: string }>({
    mutationFn: async ({ installmentId, amount, paidAt }: { installmentId: number; amount: number; paidAt?: string }) => {
      await creditsApi.payInstallment(installmentId, { amount, paidAt })
      return
    },
    onSuccess: async () => {
      // Invalidar cualquier query que comience con 'cuotas' o 'creditos'
      await queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "cuotas" })
      await queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "creditos" })
      if (detailId) await queryClient.invalidateQueries({ queryKey: ["credito", detailId] })
      // Si pagamos desde la lista y conocemos el creditId de la cuota, invalidar también ese detalle
      const paidCreditId = selectedInstallment?.creditId
      if (paidCreditId) {
        // Actualizar la caché local del detalle para mostrar el pago inmediatamente
        queryClient.setQueryData(["credito", paidCreditId], (old: unknown) => {
          if (!old) return old
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = JSON.parse(JSON.stringify(old as unknown)) as any
            const installment = copy.installments?.find((it: unknown) => (it as { id?: number }).id === selectedInstallment?.id)
            if (installment) {
              installment.status = "PAGADA"
              installment.paidAmount = (installment.paidAmount ?? 0) + (confirmPayload?.amount ?? 0)
              installment.paidAt = new Date().toISOString()
            }
            // ajustar saldo pendiente del crédito si existe
            if (typeof copy.saldoPendiente === "number") {
              copy.saldoPendiente = Math.max(0, copy.saldoPendiente - (confirmPayload?.amount ?? 0))
            }
            // Si el saldo queda en 0, marcar crédito como CANCELADO para actualizar estado y acciones
            if (typeof copy.saldoPendiente === "number" && copy.saldoPendiente <= 0) {
              copy.status = "CANCELADO"
            }
            return copy
          } catch {
            return old
          }
        })
        await queryClient.invalidateQueries({ queryKey: ["credito", paidCreditId] })
      }
      setPagoDialogOpen(false)
      setSelectedInstallment(null)
      setConfirmPayload(null)
      // Generar/descargar PDF del crédito relacionado
      try {
        const target = detailId ?? selectedInstallment?.creditId
        if (target) exportSinglePdfMutation.mutate(target)
      } catch { /* ignore */ }
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

  return (
    <div className="space-y-6">

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
            <p className="mt-2 text-3xl font-semibold text-slate-900">{installments.filter((i: Installment) => i.status === "PAGADA").length}</p>
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

      <Drawer open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
        <DrawerContent className="overflow-hidden">
            <div className="flex h-dvh flex-col">
              <DrawerHeader>
                <DrawerTitle className="pr-10">Detalle de crédito</DrawerTitle>
                <DrawerDescription>Información del crédito y sus cuotas.</DrawerDescription>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { if (detailQuery.data) exportSinglePdfMutation.mutate(detailQuery.data.id) }}
                    disabled={exportingKey !== null || exportSinglePdfMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Exportar PDF
                  </button>
                  <button type="button" onClick={() => setDetailId(null)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600">Cerrar</button>
                </div>
              </DrawerHeader>

              <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
              {detailQuery.isLoading && <div className="p-4 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}
              {detailQuery.data && (
                <div className="space-y-4">
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
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Diálogo de pago: resumen sólo lectura — aceptar o cancelar */}

      <Dialog open={pagoDialogOpen && !!selectedInstallment} onOpenChange={(open) => { if (!open) { setPagoDialogOpen(false); setSelectedInstallment(null) } }}>
        <DialogContent className="dialog-content w-full max-w-6xl overflow-hidden p-0 sm:rounded-3xl" disableOutsideClose hideCloseButton>
          <div className="flex h-[75vh] flex-col">
            <div className="border-b px-8 py-6 text-left">
              <h2 className="text-2xl font-semibold text-slate-900">Registrar pago</h2>
              <p className="text-sm text-slate-600">Resumen del pago. Solo puedes Aceptar o Cancelar.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {selectedInstallment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-700">
                      <p className="font-semibold text-slate-900 text-lg truncate">{selectedInstallment.creditoLabel}</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedInstallment.clienteLabel}</p>
                      <p className="text-xs text-slate-700 mt-1">Cuota #{selectedInstallment.number}</p>
                      <p className="text-xs text-slate-700">Vencimiento: {selectedInstallment.dueDate ? formatDate(selectedInstallment.dueDate) : "—"}</p>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-slate-500">Monto original</p>
                          <p className="text-lg font-semibold text-slate-900">{formatMoney(selectedInstallment.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
                          <p className="text-lg font-semibold text-slate-900">{formatMoney(Math.max(selectedInstallment.amount - selectedInstallment.paidAmount, 0))}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 md:col-span-1 flex flex-col">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
                      <p className="text-xs text-slate-700">Detalle</p>
                      <p className="font-semibold text-slate-900">ID: {selectedInstallment.id}</p>
                      <p className="text-sm text-slate-700 mt-2">Crédito: {selectedInstallment.creditoLabel}</p>
                      <div className="mt-4">
                        <p className="text-xs text-slate-500">Acciones</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => { setPagoDialogOpen(false); setSelectedInstallment(null) }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Cerrar">Cerrar</button>
                          <button onClick={() => { if (typeof selectedInstallment.creditId === 'number') exportSinglePdfMutation.mutate(selectedInstallment.creditId) }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label="Exportar PDF">Exportar PDF</button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
                      <p className="text-xs text-slate-700">Información</p>
                      <p className="text-sm text-slate-700 mt-2">Este pago se registrará con la fecha del día. Se actualizará el estado de la cuota a PAGADA.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 border-t px-8 py-4 flex justify-end gap-3">
              <button type="button" onClick={() => { setPagoDialogOpen(false); setSelectedInstallment(null) }} className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cerrar</button>
              <button
                onClick={() => {
                  if (!selectedInstallment) return
                  const amount = Math.max(selectedInstallment.amount - (selectedInstallment.paidAmount ?? 0), 0)
                  pagarMutation.mutate({ installmentId: selectedInstallment.id, amount, paidAt: new Date().toISOString() })
                }}
                disabled={pagarMutation.status === "pending"}
                className="rounded-xl btn-primary px-6 py-2.5 text-sm"
              >
                {pagarMutation.status === "pending" && <Loader2 className="h-4 w-4 animate-spin inline-block mr-2"/>}
                Aceptar pago
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
