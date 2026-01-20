"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CalendarClock, Check, Clock, CreditCard, DollarSign, Download, Eye, Loader2, PiggyBank, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "../../components/ui/dialog"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "../../components/ui/drawer"
import { isAxiosError } from "axios"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { creditsApi } from "../../services/creditsApi"
import type { CreditInstallment } from "../../services/creditsApi"
import { formatMoney } from "../../utils/number"
import { CreditsListHeader } from "./components/CreditsListHeader"
import type { CreditsFilterChip } from "./components/CreditsListHeader"
import { CreditsFiltersDrawer } from "./components/CreditsFiltersDrawer"
import PaginationFooter from "../../components/common/PaginationFooter"
import type { CreditsFilters } from "./components/CreditsFiltersDrawer"
export default function CreditosPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const defaultFilters: CreditsFilters = { status: "all", soloVencidas: false }
  const [filters, setFilters] = useState<CreditsFilters>(defaultFilters)
  const [filtersDraft, setFiltersDraft] = useState<CreditsFilters>(filters)
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)

  const [exportingKey, setExportingKey] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<"cuotas" | "movimientos">("cuotas")

  type InstallmentUI = CreditInstallment & { creditoLabel?: string; clienteLabel?: string }
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentUI | null>(null)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [confirmPagoOpen, setConfirmPagoOpen] = useState(false)
  const [confirmPayload, setConfirmPayload] = useState<{ amount: number; paidAt?: string } | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const listadoRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const normalizedSearch = searchInput.trim().length > 0

  const filterChips: CreditsFilterChip[] = []
  if (filters.status && filters.status !== "all") filterChips.push({ key: "status", label: String(filters.status) })
  if (filters.soloVencidas) filterChips.push({ key: "soloVencidas", label: "Solo vencidas" })

  const creditoDetalleQuery = useQuery({ queryKey: ["credito", detailId], queryFn: () => creditsApi.getCreditById(detailId as number), enabled: detailId !== null })

  function formatDate(iso?: string) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(d)
  }

  const installmentStatusClasses: Record<string, string> = {
    PENDIENTE: "bg-amber-100 text-amber-800",
    VENCIDA: "bg-red-100 text-red-800",
    PAGADA: "bg-emerald-100 text-emerald-800",
  }

  const creditStatusClasses: Record<string, string> = {
    ACTIVO: "bg-emerald-100 text-emerald-800",
    VENCIDOS: "bg-red-100 text-red-800",
    CANCELADO: "bg-slate-100 text-slate-700",
  }

  const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = (error as any).response
      return resp?.data?.error ?? resp?.data?.message ?? error.message ?? fallback
    }
    if (error instanceof Error && error.message.trim()) return error.message
    return fallback
  }

  const creditosQuery = useQuery({ queryKey: ["creditos"], queryFn: () => creditsApi.getCredits(), enabled: isAdmin })
  const cuotasVencidasQuery = useQuery({ queryKey: ["creditos", "cuotas-vencidas"], queryFn: async () => ({ total: 0, byCreditId: {} as Record<number, number> }), enabled: isAdmin })

  const filteredCreditos = creditosQuery.data ?? []
  const activos = creditosQuery.data?.length ?? 0
  const saldoPendienteTotal = (creditosQuery.data ?? []).reduce((s, c) => s + (c.saldoPendiente ?? 0), 0)

  const startItem = 1
  const endItem = filteredCreditos.length

  const handleFocusListado = () => listadoRef.current?.scrollIntoView({ behavior: "smooth" })

  const pendingAmount = selectedInstallment ? Math.max(selectedInstallment.amount - (selectedInstallment.paidAmount ?? 0), 0) : 0

  const exportMutation = useMutation({
    mutationFn: async (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv" }) => {
      const key = `${args.scope}-${args.format}`
      setExportingKey(key)
      try {
        if (args.scope === "all") {
          await creditsApi.exportCredits({ scope: "all", format: args.format })
          return
        }

        // Página actual: snapshot EXACTO de lo visible (incluye filtros/búsqueda/orden del cliente).
        const ids = filteredCreditos.map((c) => c.id)
        await creditsApi.exportCredits({ scope: "page", format: args.format, ids })
      } finally {
        setExportingKey(null)
      }
    },
    onError: () => {
      toast.error("No se pudo exportar. Intenta nuevamente.")
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
    onError: () => {
      toast.error("No se pudo exportar el crédito.")
    },
  })

  const pagarCuotaMutation = useMutation({
    mutationFn: (vars?: { installmentId: number; amount: number; paidAt?: string }) => {
      if (!vars) throw new Error("Faltan variables de la mutación de pago")
      const { installmentId, amount, paidAt } = vars
      return creditsApi.payInstallment(installmentId, { amount, paidAt })
    },
    onSuccess: async (_data, variables?: { installmentId: number; amount: number; paidAt?: string }) => {
      try { toast.success("Pago registrado") } catch (e) { void e }

      // Si el servidor devolvió la cuota actualizada, úsala como fuente de la verdad
      const serverCuota = (_data as any)?.cuota ?? null
      const serverCredit = (_data as any)?.credit ?? null

      const paidCreditId = detailId ?? creditoDetalleQuery.data?.id
      const appliedAmount = variables?.amount ?? confirmPayload?.amount ?? 0

      if (serverCuota && paidCreditId) {
        // Mapear la cuota del servidor a la forma del cliente
        const mapped = {
          id: serverCuota.id_cuota ?? serverCuota.id,
          number: serverCuota.numero_cuota ?? serverCuota.number,
          amount: Number(serverCuota.monto_cuota ?? serverCuota.amount ?? 0),
          paidAmount: Number(serverCuota.monto_pagado ?? serverCuota.paidAmount ?? 0),
          status: serverCuota.estado_cuota ?? serverCuota.status,
          paidAt: serverCuota.fecha_pago ? new Date(serverCuota.fecha_pago).toISOString() : null,
        }

        // Actualizar cache del detalle del crédito
        queryClient.setQueryData(["credito", paidCreditId], (old: unknown) => {
          if (!old) return old
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = JSON.parse(JSON.stringify(old as unknown)) as any
            if (!Array.isArray(copy.installments)) return old
            const idx = copy.installments.findIndex((it: any) => it.id === mapped.id)
            if (idx >= 0) {
              copy.installments[idx] = {
                ...copy.installments[idx],
                id: mapped.id,
                number: mapped.number,
                amount: mapped.amount,
                paidAmount: mapped.paidAmount,
                status: mapped.status,
                paidAt: mapped.paidAt,
              }
            }
            if (serverCredit && typeof serverCredit.saldoPendiente === "number") {
              copy.saldoPendiente = serverCredit.saldoPendiente
            }
            if (typeof copy.saldoPendiente === "number" && copy.saldoPendiente <= 0) {
              copy.status = "CANCELADO"
            }
            return copy
          } catch {
            return old
          }
        })

        // Actualizar cache del listado de créditos
        queryClient.setQueryData(["creditos"], (old: unknown) => {
          if (!old) return old
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const list = JSON.parse(JSON.stringify(old as unknown)) as any
            const credit = list.find((c: any) => c.id === paidCreditId)
            if (credit) {
              const instIdx = Array.isArray(credit.installments) ? credit.installments.findIndex((it: any) => it.id === mapped.id) : -1
              if (instIdx >= 0) {
                credit.installments[instIdx] = {
                  ...credit.installments[instIdx],
                  id: mapped.id,
                  number: mapped.number,
                  amount: mapped.amount,
                  paidAmount: mapped.paidAmount,
                  status: mapped.status,
                  paidAt: mapped.paidAt,
                }
              }
              if (serverCredit && typeof serverCredit.saldoPendiente === "number") {
                credit.saldoPendiente = serverCredit.saldoPendiente
              } else if (typeof credit.saldoPendiente === "number") {
                credit.saldoPendiente = Math.max(0, credit.saldoPendiente - (appliedAmount ?? 0))
              }
              if (Array.isArray(credit.installments)) {
                const next = credit.installments
                  .filter((c: any) => Math.max(c.amount - (c.paidAmount ?? 0), 0) > 0.0001 && c.status !== "PAGADA")
                  .sort((a: any, b: any) => new Date(a.dueDate || a.fecha_vencimiento || 0).getTime() - new Date(b.dueDate || b.fecha_vencimiento || 0).getTime())[0]
                credit.nextInstallment = next ?? null
              }
            }
            return list
          } catch {
            return old
          }
        })
      } else if (paidCreditId && selectedInstallment) {
        // Fallback: comportamiento previo (optimista)
        queryClient.setQueryData(["credito", paidCreditId], (old: unknown) => {
          if (!old) return old
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = JSON.parse(JSON.stringify(old as unknown)) as any
            const installment = copy.installments?.find((it: unknown) => (it as { id?: number }).id === selectedInstallment.id)
            if (installment) {
              installment.status = "PAGADA"
              installment.paidAmount = (installment.paidAmount ?? 0) + (appliedAmount ?? 0)
              installment.paidAt = new Date().toISOString()
            }
            if (typeof copy.saldoPendiente === "number") copy.saldoPendiente = Math.max(0, copy.saldoPendiente - (appliedAmount ?? 0))
            if (typeof copy.saldoPendiente === "number" && copy.saldoPendiente <= 0) copy.status = "CANCELADO"
            return copy
          } catch {
            return old
          }
        })
      }

      // Invalidar consultas derivadas y refetch (no obligatorio pero seguro)
      await queryClient.invalidateQueries({ queryKey: ["creditos", "cuotas-vencidas"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })

      // Intentar refetch para sincronizar datos restantes (no bloquear flujo)
      try {
        await queryClient.refetchQueries({ queryKey: ["creditos"], exact: false })
        await queryClient.refetchQueries({ queryKey: ["credito"], exact: false })
      } catch (e) { void e }

      // Polling de confirmación: si no recibimos la cuota actualizada del servidor,
      // intentamos refetch del detalle hasta que la cuota aparezca como PAGADA.
      // Esto evita el rebote a PENDIENTE por inconsistencias de lectura.
      if (paidCreditId) {
        const maxAttempts = 6
        const delayMs = 500
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
            // Refetchar el detalle y comprobar el estado de la cuota
            const fresh = await queryClient.fetchQuery({ queryKey: ["credito", paidCreditId], queryFn: () => creditsApi.getCreditById(paidCreditId) })
            if (fresh && Array.isArray((fresh as any).installments)) {
              const found = (fresh as any).installments.find((it: any) => it.id === (serverCuota?.id_cuota ?? variables?.installmentId ?? selectedInstallment?.id))
              if (found && (found.estado_cuota === "PAGADO" || found.status === "PAGADA" || found.status === "PAGADO")) {
                // Se confirmó el pago en servidor: actualizar cache si necesario y terminar polling
                queryClient.setQueryData(["credito", paidCreditId], fresh)
                break
              }
            }
          } catch (e) {
            // ignorar errores puntuales y reintentar
            void e
          }
          // Esperar antes del siguiente intento
          await new Promise((res) => setTimeout(res, delayMs))
        }
      }

      setPaymentError(null)
      setPagoDialogOpen(false)
      setSelectedInstallment(null)
      setConfirmPagoOpen(false)
      setConfirmPayload(null)
      try {
        const targetCreditId = detailId ?? creditoDetalleQuery.data?.id
        if (targetCreditId) exportSinglePdfMutation.mutate(targetCreditId)
      } catch (e) { void e }
    },
    onError: (error: unknown) => {
      setPaymentError(getApiErrorMessage(error, "No se pudo registrar el pago"))
    },
  })

  // El formulario fue removido; confirmPayload se asigna directamente desde el UI cuando aplica.

  const closeDetailDialog = () => {
    setDetailId(null)
		setDetailTab("cuotas")
    setSelectedInstallment(null)
    setPagoDialogOpen(false)
    setPaymentError(null)
  }

  const handlePagoDialogChange = (open: boolean) => {
    if (!open) {
      setPagoDialogOpen(false)
      setSelectedInstallment(null)
      setPaymentError(null)
    } else {
      setPagoDialogOpen(true)
    }
  }

  const renderSaldo = (valor: number) => (
		<span className={valor > 0 ? "text-slate-900 font-semibold" : "text-emerald-600 font-semibold"}>
			{formatMoney(valor)}
		</span>
	)

  // Cualquier usuario sin rol ADMIN ve un mensaje claro en lugar del tablero.
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar créditos y cuotas.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="creditos-encabezado" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p id="creditos-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              FINANCIAMIENTO
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Créditos y cuotas</h1>
            <p className="mt-1 text-sm text-slate-500">Seguimiento de cobros, saldos y vencimientos en un solo panel.</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
            <button
              type="button"
              onClick={handleFocusListado}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              aria-label="Ver vencimientos"
            >
              <CalendarClock className="h-4 w-4" />
              Ver vencimientos
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Créditos activos</p>
            <CreditCard className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activos}</p>
          <p className="text-sm text-slate-500">Cartera en seguimiento</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
            <PiggyBank className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatMoney(saldoPendienteTotal)}</p>
          <p className="text-sm text-slate-500">Monto por cobrar</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Cuotas vencidas</p>
            <Clock className="h-5 w-5 text-red-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-600">{cuotasVencidasQuery.data?.total ?? 0}</p>
          <p className="text-sm text-slate-500">Vencimientos críticos</p>
        </article>
      </section>

      {creditosQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            {getApiErrorMessage(creditosQuery.error, "No se pudieron cargar los créditos")}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div ref={listadoRef} className="col-span-12 lg:col-span-12">
          <section aria-labelledby="creditos-listado" className="rounded-2xl border border-slate-200 bg-white">
            <CreditsListHeader
              startItem={startItem}
              endItem={endItem}
              resultsCount={filteredCreditos.length}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onExport={(args) => exportMutation.mutate(args)}
              exportingKey={exportingKey}
              filterChips={filterChips}
              onRemoveChip={(key) => {
                if (key === "status") setFilters((prev) => ({ ...prev, status: "all" }))
                if (key === "soloVencidas") setFilters((prev) => ({ ...prev, soloVencidas: false }))
              }}
              onClearAllFilters={() => setFilters(defaultFilters)}
              onOpenFilters={() => {
                setFiltersDraft(filters)
                setFiltersDrawerOpen(true)
              }}
              searchInputRef={searchInputRef}
            />

          <div className="px-6 pb-6">
            {creditosQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando cartera...
              </div>
            )}

            {!creditosQuery.isLoading && filteredCreditos.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {normalizedSearch ? "Sin resultados para la búsqueda." : "Aún no hay créditos registrados."}
              </div>
            )}

            {!creditosQuery.isLoading && filteredCreditos.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3">Factura</th>
                      <th className="px-6 py-3">Cliente</th>
                      <th className="px-6 py-3">Saldo pendiente</th>
                      <th className="px-6 py-3">Próximo vencimiento</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCreditos.map((credito) => {
                      const clienteLabel = `${credito.cliente.nombres} ${credito.cliente.apellidos}`
                      const nextCuota = credito.nextInstallment
                      const statusClass = creditStatusClasses[credito.status]
                      const overdueCount = cuotasVencidasQuery.data?.byCreditId?.[credito.id] ?? 0
                      const canPay = !!nextCuota && nextCuota.status !== "PAGADA" && credito.status !== "CANCELADO"

                      return (
                        <tr key={credito.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">{credito.sale.code || `Crédito #${credito.id}`}</p>
                            <p className="text-xs text-slate-500">#{credito.id}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">{clienteLabel}</p>
                            <p className="text-xs text-slate-500">{credito.cliente.cedula || "—"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm">{renderSaldo(credito.saldoPendiente)}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {nextCuota ? (
                              <div>
                                <p className="font-semibold">{formatMoney(nextCuota.amount)}</p>
                                <p className="text-xs text-slate-500">{formatDate(nextCuota.dueDate)}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-emerald-600">Sin pendientes</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                {credito.status}
                              </span>
                              {overdueCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                  Vencidas: {overdueCount}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setDetailTab("cuotas")
                    setDetailId(credito.id)
                  }}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="Ver crédito"
                  title="Ver"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (!nextCuota) return
                    setSelectedInstallment({
                      id: nextCuota.id,
                      number: nextCuota.number,
                      dueDate: nextCuota.dueDate,
                      amount: nextCuota.amount,
                      paidAmount: 0,
                      status: nextCuota.status,
                      paidAt: null,
                      creditoLabel: credito.sale.code || `Crédito #${credito.id}`,
                      clienteLabel,
                    })
                    setPagoDialogOpen(true)
                  }}
                  disabled={!canPay || pagarCuotaMutation.isPending}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Cobrar próxima cuota"
                  title={canPay ? "Cobrar" : "Sin cuotas pendientes"}
                >
                  <DollarSign className="h-4 w-4" />
                </button>
              </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <PaginationFooter
            currentPage={1}
            totalPages={1}
            pageSize={10}
            pageSizeOptions={[10, 20, 30]}
            onPrev={() => {}}
            onNext={() => {}}
            onPageSizeChange={() => {}}
          />
        </section>
      </div>

      {/* Panel de vencimientos movido al Dashboard */}
    </div>

    <CreditsFiltersDrawer
      open={filtersDrawerOpen}
      onOpenChange={setFiltersDrawerOpen}
      filtersDraft={filtersDraft}
      setFiltersDraft={setFiltersDraft}
      onCancel={() => {
        setFiltersDraft(filters)
        setFiltersDrawerOpen(false)
      }}
      onClearDraft={() => setFiltersDraft(defaultFilters)}
      onApply={() => {
        setFilters(filtersDraft)
        setFiltersDrawerOpen(false)
      }}
    />

      <Drawer open={detailId !== null} onOpenChange={(open) => { if (!open) closeDetailDialog() }}>
        <DrawerContent className="overflow-hidden max-w-2xl">
          <div className="flex h-dvh flex-col">
            <DrawerHeader>
              <DrawerTitle className="pr-10">Detalle de crédito</DrawerTitle>
              <DrawerDescription>Consulta el saldo, cuotas programadas y registra pagos rápidamente.</DrawerDescription>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => creditoDetalleQuery.data && exportSinglePdfMutation.mutate(creditoDetalleQuery.data.id)}
                  disabled={exportingKey !== null || exportSinglePdfMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Exportar PDF
                </button>
                <button type="button" onClick={() => closeDetailDialog()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600">Cerrar</button>
              </div>
            </DrawerHeader>

            <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
              {creditoDetalleQuery.isLoading && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando detalle...
                </div>
              )}

              {creditoDetalleQuery.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {getApiErrorMessage(creditoDetalleQuery.error, "No se pudo cargar el crédito" )}
                </div>
              )}

              {creditoDetalleQuery.data && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {creditoDetalleQuery.data.saleCode || `Crédito #${creditoDetalleQuery.data.id}`}
                        </p>
                        <p className="text-sm text-slate-500">
                          Cliente: {`${creditoDetalleQuery.data.cliente.nombres} ${creditoDetalleQuery.data.cliente.apellidos}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                        <p className="text-xs uppercase text-slate-500">Monto total</p>
                        <p className="text-lg font-semibold text-slate-900">{formatMoney(creditoDetalleQuery.data.total)}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                        <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
                        <p className="text-lg font-semibold text-emerald-700">{formatMoney(creditoDetalleQuery.data.saldoPendiente)}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                        <p className="text-xs uppercase text-slate-500">Estado</p>
                        <p className="text-base font-semibold text-slate-900">{creditoDetalleQuery.data.status}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                        <p className="text-xs uppercase text-slate-500">Próxima cuota</p>
                        {(() => {
                          const next = creditoDetalleQuery.data.installments
                            .filter((c) => Math.max(c.amount - c.paidAmount, 0) > 0.0001 && c.status !== "PAGADA")
                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

                          if (!next) return <p className="text-base font-semibold text-emerald-700">Sin pendientes</p>

                          return (
                            <div>
                              <p className="text-lg font-semibold text-slate-900">{formatMoney(next.amount)}</p>
                              <p className="text-xs text-slate-500">{formatDate(next.dueDate)}</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setDetailTab("cuotas")}
                        className={
                          "rounded-xl px-3 py-1.5 text-sm font-semibold transition " +
                          (detailTab === "cuotas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60")
                        }
                      >
                        Cuotas
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("movimientos")}
                        className={
                          "rounded-xl px-3 py-1.5 text-sm font-semibold transition " +
                          (detailTab === "movimientos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60")
                        }
                      >
                        Movimientos
                      </button>
                    </div>

                    {detailTab === "cuotas" ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left">Cuota</th>
                              <th className="px-4 py-3 text-left">Vencimiento</th>
                              <th className="px-4 py-3 text-left">Monto</th>
                              <th className="px-4 py-3 text-left">Saldo</th>
                              <th className="px-4 py-3 text-left">Estado</th>
                              <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {creditoDetalleQuery.data.installments.map((cuota: CreditInstallment) => {
                              const saldoCuota = Math.max(cuota.amount - cuota.paidAmount, 0)
                              const cuotaStatus = installmentStatusClasses[cuota.status] ?? "bg-slate-100 text-slate-700"
                              return (
                                <tr key={cuota.id}>
                                  <td className="px-4 py-3 text-slate-700">#{cuota.number}</td>
                                  <td className="px-4 py-3 text-slate-700">{formatDate(cuota.dueDate)}</td>
                                  <td className="px-4 py-3 text-slate-900 font-semibold">{formatMoney(cuota.amount)}</td>
                                  <td className="px-4 py-3 text-slate-900 font-semibold">{formatMoney(saldoCuota)}</td>
                                  <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cuotaStatus}`}>
                                      {cuota.status === "PAGADA" ? "PAGADA" : cuota.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {cuota.status !== "PAGADA" && saldoCuota > 0 ? (
                                      <button
                                        onClick={() => {
                                          setSelectedInstallment({
                                            ...(cuota as InstallmentUI),
                                            creditoLabel: creditoDetalleQuery.data.saleCode || `Crédito #${creditoDetalleQuery.data.id}`,
                                            clienteLabel: `${creditoDetalleQuery.data.cliente.nombres} ${creditoDetalleQuery.data.cliente.apellidos}`,
                                          })
                                          setPagoDialogOpen(true)
                                        }}
                                        disabled={pagarCuotaMutation.isPending}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                                      >
                                        Registrar pago
                                      </button>
                                    ) : cuota.status === "PAGADA" ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-700">
                                        <Check className="h-4 w-4" />
                                        <span className="sr-only">Pagada</span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="p-6">
                        {(() => {
                          const movimientos = creditoDetalleQuery.data.installments
                            .filter((c: CreditInstallment) => c.status === "PAGADA" && !!c.paidAt)
                            .map((c: CreditInstallment) => ({
                              id: c.id,
                              number: c.number,
                              paidAt: c.paidAt as string,
                              amount: c.paidAmount > 0 ? c.paidAmount : c.amount,
                            }))
                            .sort((a: { paidAt: string }, b: { paidAt: string }) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())

                          if (movimientos.length === 0) {
                            return (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                No hay movimientos registrados aún.
                              </div>
                            )
                          }

                          return (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Fecha</th>
                                    <th className="px-4 py-3 text-left">Cuota</th>
                                    <th className="px-4 py-3 text-left">Monto</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {movimientos.map((m: { id: number; number: number; paidAt: string; amount: number }) => (
                                    <tr key={m.id}>
                                      <td className="px-4 py-3 text-slate-700">{formatDate(m.paidAt)}</td>
                                      <td className="px-4 py-3 text-slate-700">#{m.number}</td>
                                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(m.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={pagoDialogOpen && !!selectedInstallment} onOpenChange={handlePagoDialogChange}>
        <DialogContent hideCloseButton disableOutsideClose className="w-[90%] max-w-4xl h-[85vh] bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Registrar pago</DialogTitle>
            <DialogDescription className="text-sm">Confirma para procesar el pago y actualizar el estado de la cuota.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedInstallment && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-base text-slate-700">
                  <p className="font-semibold text-slate-900 text-lg truncate">{selectedInstallment.creditoLabel}</p>
                  <p className="text-sm text-slate-700 mt-1">{selectedInstallment.clienteLabel}</p>
                  <p className="text-xs text-slate-700 mt-1">Cuota #{selectedInstallment.number}</p>
                  <p className="text-xs text-slate-700">Vencimiento: {selectedInstallment.dueDate ? formatDate(selectedInstallment.dueDate) : "—"}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Monto original</p>
                      <p className="text-lg font-semibold text-slate-900">{formatMoney(selectedInstallment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
                      <p className="text-lg font-semibold text-emerald-700">{formatMoney(pendingAmount)}</p>
                    </div>
                  </div>
                  {paymentError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mt-3">{paymentError}</div>
                  )}
                </div>

                <div className="space-y-4 md:col-span-1">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
                    <p className="text-xs text-slate-700">Detalle</p>
                    <p className="font-semibold text-slate-900 mt-2">ID: {selectedInstallment.id}</p>
                    <p className="text-sm text-slate-700 mt-1">Crédito: {selectedInstallment.creditoLabel}</p>
                    <div className="mt-3">
                      <p className="text-xs text-slate-500">Acciones</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => { if (typeof creditoDetalleQuery.data?.id === 'number') exportSinglePdfMutation.mutate(creditoDetalleQuery.data.id) }} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Exportar PDF</button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
                    <p className="text-xs text-slate-700">Información</p>
                    <p className="text-sm text-slate-700 mt-2">El pago se registrará con la fecha de hoy y la cuota quedará marcada como PAGADA.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t flex justify-end gap-2">
            <button type="button" onClick={() => handlePagoDialogChange(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button
              onClick={() => {
                if (!selectedInstallment) return
                const amount = Math.max(selectedInstallment.amount - (selectedInstallment.paidAmount ?? 0), 0)
                pagarCuotaMutation.mutate({ installmentId: selectedInstallment.id, amount, paidAt: new Date().toISOString() })
              }}
              disabled={pagarCuotaMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pagarCuotaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aceptar pago
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación final antes de ejecutar el pago */}
      <Dialog open={confirmPagoOpen && !!selectedInstallment && !!confirmPayload} onOpenChange={(open) => { if (!open) setConfirmPagoOpen(false) }}>
        <DialogContent className="bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
            <DialogDescription>¿Confirmas el pago de la cuota #{selectedInstallment?.number} por {confirmPayload ? formatMoney(confirmPayload.amount) : "—"}? (fecha: hoy)</DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmPagoOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedInstallment || !confirmPayload) return
                  pagarCuotaMutation.mutate({ installmentId: selectedInstallment.id, amount: confirmPayload.amount, paidAt: confirmPayload.paidAt })
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={pagarCuotaMutation.isPending}
              >
                {pagarCuotaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar pago
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}