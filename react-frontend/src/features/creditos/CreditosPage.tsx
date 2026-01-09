"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, CalendarClock, Clock, CreditCard, DollarSign, Eye, Loader2, PiggyBank, ShieldAlert } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { creditsApi } from "../../services/creditsApi"
import type { CreditDetail, CreditListItem, CreditStatus, CreditInstallment, InstallmentStatus } from "../../services/creditsApi"
import { formatMoney, round2 } from "../../utils/number"
import { CreditsListHeader } from "./components/CreditsListHeader"
import type { CreditsFilterChip } from "./components/CreditsListHeader"
import { CreditsFiltersDrawer } from "./components/CreditsFiltersDrawer"
import type { CreditsFilters } from "./components/CreditsFiltersDrawer"

type SelectedInstallmentState = CreditInstallment & {
	creditoLabel: string
	clienteLabel: string
}

type PagoFormValues = {
	amount: number
	paidAt: string
}

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
	dateStyle: "medium",
})

const creditStatusClasses: Record<CreditStatus, string> = {
  ACTIVO: "bg-emerald-50 text-emerald-700",
  EN_MORA: "bg-red-50 text-red-700",
  CANCELADO: "bg-slate-100 text-slate-700",
}

const installmentStatusClasses: Record<InstallmentStatus, string> = {
	PENDIENTE: "bg-amber-100 text-amber-800",
	VENCIDA: "bg-red-100 text-red-800",
	PAGADA: "bg-emerald-100 text-emerald-800",
}

// Siempre mostramos el error real del API antes de caer en un mensaje genérico.
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const err = error as { response?: { data?: { error?: string; message?: string } } }
    return err.response?.data?.error ?? err.response?.data?.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

function formatDate(iso: string): string {
	if (!iso) return "—"
	const parsed = new Date(iso)
	if (Number.isNaN(parsed.getTime())) return "—"
	return dateFormatter.format(parsed)
}

const buildPagoSchema = (expectedAmount: number) =>
	z.object({
		amount: z
			.number()
			.refine((value) => Number.isFinite(value), { message: "Ingresa un monto válido" })
			.refine((value) => Math.abs(round2(value) - round2(expectedAmount)) < 0.001, {
				message: `Debe ser exactamente ${formatMoney(expectedAmount)}`,
			}),
		paidAt: z.string().min(1, "Selecciona una fecha"),
	})

export default function CreditosPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<"cuotas" | "movimientos">("cuotas")
  const [selectedInstallment, setSelectedInstallment] = useState<SelectedInstallmentState | null>(null)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
	const [searchInput, setSearchInput] = useState("")
	const listadoRef = useRef<HTMLDivElement | null>(null)
	const searchInputRef = useRef<HTMLInputElement | null>(null)
  const defaultFilters = useMemo<CreditsFilters>(() => ({ status: "all", soloVencidas: false }), [])
  const [filters, setFilters] = useState<CreditsFilters>(defaultFilters)
  const [filtersDraft, setFiltersDraft] = useState<CreditsFilters>(defaultFilters)
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)

  // Esta consulta trae el tablero completo y sólo corre si el usuario es admin.
  const creditosQuery = useQuery<CreditListItem[]>({
		queryKey: ["creditos"],
		enabled: isAdmin,
		queryFn: () => creditsApi.list(),
	})

  // Al abrir el modal cargamos el crédito puntual con todas sus cuotas.
  const creditoDetalleQuery = useQuery<CreditDetail>({
		queryKey: ["credito", detailId],
		enabled: detailId !== null,
		queryFn: () => creditsApi.getById(detailId as number),
	})

  const creditos = useMemo(() => creditosQuery.data ?? [], [creditosQuery.data])

  const creditIds = useMemo(() => creditos.map((c) => c.id), [creditos])

  // KPI + UI: cuotas vencidas (conteo total y por crédito, para chips "Vencidas: N").
  const cuotasVencidasQuery = useQuery<{ total: number; byCreditId: Record<number, number> }>({
		queryKey: ["creditos", "cuotas-vencidas", creditIds],
		enabled: isAdmin && creditIds.length > 0,
		queryFn: async () => {
			const details = await Promise.all(creditIds.map((id) => creditsApi.getById(id)))
      const byCreditId: Record<number, number> = {}
      let total = 0
      for (const d of details) {
        const count = d.installments.filter((i) => i.status === "VENCIDA").length
        byCreditId[d.id] = count
        total += count
      }
      return { total, byCreditId }
		},
		staleTime: 1000 * 30,
		refetchOnWindowFocus: false,
	})

  // Métricas rápidas para el header: cuántos créditos siguen vivos y cuánto debemos.
  const activos = useMemo(() => creditos.filter((c) => c.saldoPendiente > 0.0001).length, [creditos])
  const saldoPendienteTotal = useMemo(() => creditos.reduce((acc, c) => acc + c.saldoPendiente, 0), [creditos])

  const proximasCuotas = useMemo(() => {
		const rows = creditos
			.filter((c) => c.nextInstallment)
			.map((c) => ({
				creditId: c.id,
				saleCode: c.sale.code,
				clienteLabel: `${c.cliente.nombres} ${c.cliente.apellidos}`,
				installment: c.nextInstallment as NonNullable<CreditListItem["nextInstallment"]>,
			}))
		rows.sort((a, b) => new Date(a.installment.dueDate).getTime() - new Date(b.installment.dueDate).getTime())
		return rows.slice(0, 4)
	}, [creditos])

  const normalizedSearch = useMemo(() => searchInput.trim().toLowerCase(), [searchInput])

  const creditHasOverdue = useMemo(() => {
    const byId = cuotasVencidasQuery.data?.byCreditId
    return (credito: CreditListItem) => {
      const fromQuery = byId?.[credito.id]
      if (typeof fromQuery === "number") return fromQuery > 0
      return credito.nextInstallment?.status === "VENCIDA"
    }
  }, [cuotasVencidasQuery.data?.byCreditId])

  const filterChips = useMemo<CreditsFilterChip[]>(() => {
    const chips: CreditsFilterChip[] = []
    if (filters.status !== "all") chips.push({ key: "status", label: `Estado: ${filters.status}` })
    if (filters.soloVencidas) chips.push({ key: "soloVencidas", label: "Solo con vencidas" })
    return chips
  }, [filters])

  const filteredCreditos = useMemo(() => {
    return creditos.filter((credito) => {
      if (filters.status !== "all" && credito.status !== filters.status) return false
      if (filters.soloVencidas && !creditHasOverdue(credito)) return false

      if (!normalizedSearch) return true
      const factura = (credito.sale.code ?? "").toLowerCase()
      const clienteNombre = `${credito.cliente.nombres} ${credito.cliente.apellidos}`.toLowerCase()
      const cedula = (credito.cliente.cedula ?? "").toLowerCase()
      return factura.includes(normalizedSearch) || clienteNombre.includes(normalizedSearch) || cedula.includes(normalizedSearch)
    })
  }, [creditos, normalizedSearch, filters, creditHasOverdue])

  const startItem = filteredCreditos.length === 0 ? 0 : 1
  const endItem = filteredCreditos.length

  const handleFocusListado = () => {
    listadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    searchInputRef.current?.focus()
  }

  const pendingAmount = selectedInstallment
		? Math.max(selectedInstallment.amount - selectedInstallment.paidAmount, 0)
		: 0

  const pagoSchema = useMemo(() => buildPagoSchema(pendingAmount), [pendingAmount])

  const pagoForm = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      amount: pendingAmount,
      paidAt: new Date().toISOString().slice(0, 10),
    },
  })

  useEffect(() => {
    if (selectedInstallment && pendingAmount > 0) {
      pagoForm.reset({
        amount: round2(pendingAmount),
        paidAt: new Date().toISOString().slice(0, 10),
      })
    } else {
      pagoForm.reset({
        amount: 0,
        paidAt: new Date().toISOString().slice(0, 10),
      })
    }
  }, [selectedInstallment, pendingAmount, pagoForm])

  const pagarCuotaMutation = useMutation({
    mutationFn: ({ installmentId, amount, paidAt }: { installmentId: number; amount: number; paidAt: string }) =>
      creditsApi.payInstallment(installmentId, { amount, paidAt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creditos"] })
      if (detailId) {
        await queryClient.invalidateQueries({ queryKey: ["credito", detailId] })
      }
      await queryClient.invalidateQueries({ queryKey: ["creditos", "cuotas-vencidas"] })
			await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setPaymentError(null)
      setPagoDialogOpen(false)
      setSelectedInstallment(null)
    },
    onError: (error: unknown) => {
      setPaymentError(getApiErrorMessage(error, "No se pudo registrar el pago"))
    },
  })

  // Enviamos el formulario sólo si hay cuota seleccionada; el resto es UX.
  const onPagoSubmit = pagoForm.handleSubmit((values) => {
    if (!selectedInstallment) return
    setPaymentError(null)
    pagarCuotaMutation.mutate({
      installmentId: selectedInstallment.id,
      amount: values.amount,
      paidAt: values.paidAt,
    })
  })

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
        <div ref={listadoRef} className="col-span-12 lg:col-span-8">
          <section aria-labelledby="creditos-listado" className="rounded-2xl border border-slate-200 bg-white">
            <CreditsListHeader
              startItem={startItem}
              endItem={endItem}
              resultsCount={filteredCreditos.length}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
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
						const canPay = !!nextCuota && nextCuota.status !== "PAGADA"

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
        </section>
      </div>

      <aside className="col-span-12 lg:col-span-4">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobros</p>
                <p className="mt-1 text-base font-semibold text-slate-900">Vencimientos próximos</p>
                <p className="text-xs text-slate-500">Agenda tu seguimiento antes de que entren en mora.</p>
              </div>
              <Clock className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4">
              {proximasCuotas.length === 0 ? (
                <p className="text-sm text-slate-500">No hay vencimientos cercanos.</p>
              ) : (
                <ul className="space-y-3">
                  {proximasCuotas.map((row) => (
                    <li key={row.installment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="font-semibold text-slate-900">{row.saleCode}</p>
                      <p className="mt-1 text-xs text-slate-600">{row.clienteLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(row.installment.dueDate)}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatMoney(row.installment.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </aside>
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

      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) closeDetailDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de crédito</DialogTitle>
            <DialogDescription>Consulta el saldo, cuotas programadas y registra pagos rápidamente.</DialogDescription>
          </DialogHeader>

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
                <p className="text-base font-semibold text-slate-900">
                  {creditoDetalleQuery.data.saleCode || `Crédito #${creditoDetalleQuery.data.id}`}
                </p>
                <p className="text-sm text-slate-500">
                  Cliente: {`${creditoDetalleQuery.data.cliente.nombres} ${creditoDetalleQuery.data.cliente.apellidos}`}
                </p>
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
                        {creditoDetalleQuery.data.installments.map((cuota) => {
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
                                  {cuota.status === "PAGADA" && cuota.paidAt
									? `PAGADA · ${formatDate(cuota.paidAt)}`
									: cuota.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
								{cuota.status !== "PAGADA" && saldoCuota > 0 ? (
									<button
										onClick={() => {
											setSelectedInstallment({
												...cuota,
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
                ) : (
                  <div className="p-6">
                    {(() => {
                      const movimientos = creditoDetalleQuery.data.installments
                        .filter((c) => c.status === "PAGADA" && !!c.paidAt)
                        .map((c) => ({
                          id: c.id,
                          number: c.number,
                          paidAt: c.paidAt as string,
                          amount: c.paidAmount > 0 ? c.paidAmount : c.amount,
                        }))
                        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())

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
                              {movimientos.map((m) => (
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
        </DialogContent>
      </Dialog>

      <Dialog open={pagoDialogOpen && !!selectedInstallment} onOpenChange={handlePagoDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Registra el pago completo de la cuota seleccionada.</DialogDescription>
          </DialogHeader>

          {selectedInstallment && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedInstallment.creditoLabel}</p>
                <p>{selectedInstallment.clienteLabel}</p>
                <p className="text-xs text-slate-500">Cuota #{selectedInstallment.number}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Monto original</span>
                  <strong>{formatMoney(selectedInstallment.amount)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Saldo pendiente</span>
                  <strong className="text-emerald-700">{formatMoney(pendingAmount)}</strong>
                </div>
              </div>

              {paymentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{paymentError}</div>
              )}

              <form onSubmit={onPagoSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Monto a pagar</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...pagoForm.register("amount", { valueAsNumber: true })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {pagoForm.formState.errors.amount && (
                    <p className="mt-1 text-xs text-red-600">{pagoForm.formState.errors.amount.message}</p>
                  )}
                </div>

				<div>
					<label className="text-xs font-medium uppercase text-slate-500">Fecha</label>
					<input
						type="date"
						{...pagoForm.register("paidAt")}
						className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					{pagoForm.formState.errors.paidAt && (
						<p className="mt-1 text-xs text-red-600">{pagoForm.formState.errors.paidAt.message}</p>
					)}
				</div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handlePagoDialogChange(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pagarCuotaMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {pagarCuotaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Registrar pago
                  </button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}