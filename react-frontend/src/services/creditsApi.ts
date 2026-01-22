import { httpRequest } from "./httpClient"
import { toNumberSafe } from "../utils/number"
import { api } from "../lib/apiClient"
import { filenameFromContentDisposition } from "../shared/export/contentDisposition"
import { downloadBlob } from "../shared/export/downloadBlob"

export type CreditStatus = "ACTIVO" | "VENCIDOS" | "CANCELADO"
export type InstallmentStatus = "PENDIENTE" | "VENCIDA" | "PAGADA" | "PARCIAL"

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA"

export type InstallmentUiStatus = "PENDIENTE" | "PARCIAL" | "PAGADO" | "VENCIDO"

export type CreditInstallmentDetail = {
	id: number
	numero: number
	fechaVencimiento: string
	montoOriginal: number
	montoPagado: number
	saldoPendiente: number
	estado: InstallmentUiStatus
	dias: number
	parcial: boolean
	rawStatus?: string
	paidAt: string | null
}

export type CreditMovementType = "PAGO" | "AJUSTE" | "CONDONACION" | "REPROGRAMACION" | string

export type CreditMovement = {
	id: number
	creditoId: number
	cuotaId: number
	fecha: string
	tipo: CreditMovementType
	monto: number
	metodo: string
	referencia: string | null
	nota: string | null
	usuario: {
		id: number
		nombre: string
		rol: string
	}
}

export type CreditDetailResponse = {
	credito: {
		id: number
		saleId: number
		saleCode: string
		cliente: ClienteMini
		total: number
		saldoPendiente: number
		status: CreditStatus
		fechaInicio?: string
		fechaFin?: string | null
	}
	installments: CreditInstallmentDetail[]
	movimientos: CreditMovement[]
}

export type ClienteMini = {
	id_cliente: number
	nombres: string
	apellidos: string
	cedula: string
}

export type NextInstallment = {
	id: number
	number: number
	dueDate: string
	amount: number
	status: InstallmentStatus
}

export type CreditListItem = {
	id: number
	sale: {
		id: number
		code: string
	}
	cliente: ClienteMini
	saldoPendiente: number
	status: CreditStatus
	nextInstallment: NextInstallment | null
}

export type CreditInstallment = {
	id: number
	number: number
	dueDate: string
	amount: number
	paidAmount: number
	status: InstallmentStatus
	paidAt: string | null
}

export type CreditDetail = {
	id: number
	saleId: number
	saleCode: string
	cliente: ClienteMini
	total: number
	saldoPendiente: number
	status: CreditStatus
	installments: CreditInstallment[]
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ""): string {
	if (typeof value === "string") return value
	if (value === null || value === undefined) return fallback
	return String(value)
}

function normalizeCliente(raw: unknown): ClienteMini {
	const r = asRecord(raw)
	return {
		id_cliente: toNumberSafe(r.id_cliente),
		nombres: asString(r.nombres),
		apellidos: asString(r.apellidos),
		cedula: asString(r.cedula),
	}
}

function normalizeNextInstallment(raw: unknown): NextInstallment {
	const r = asRecord(raw)
	const status = typeof r.status === "string" ? r.status : ""
	return {
		id: toNumberSafe(r.id),
		number: toNumberSafe(r.number),
		dueDate: asString(r.dueDate),
		amount: toNumberSafe(r.amount),
		status: normalizeInstallmentStatus(status),
	}
}

function normalizeCreditListItem(raw: unknown): CreditListItem {
	const r = asRecord(raw)
	const sale = asRecord(r.sale)
	const status = typeof r.status === "string" ? r.status : ""
	return {
		id: toNumberSafe(r.id),
		sale: {
			id: toNumberSafe(sale.id),
			code: asString(sale.code),
		},
		saldoPendiente: toNumberSafe(r.saldoPendiente),
		status: (status === "VENCIDOS" || status === "CANCELADO" ? status : "ACTIVO") as CreditStatus,
		cliente: normalizeCliente(r.cliente),
		nextInstallment: r.nextInstallment ? normalizeNextInstallment(r.nextInstallment) : null,
	}
}

function normalizeInstallment(raw: unknown): CreditInstallment {
	const r = asRecord(raw)
	const status = typeof r.status === "string" ? r.status : ""
	return {
		id: toNumberSafe(r.id),
		number: toNumberSafe(r.number),
		dueDate: asString(r.dueDate),
		amount: toNumberSafe(r.amount),
		paidAmount: toNumberSafe(r.paidAmount),
		status: normalizeInstallmentStatus(status),
		paidAt: r.paidAt ? asString(r.paidAt) : null,
	}
}

function normalizeInstallmentStatus(status: string): InstallmentStatus {
	if (status === "PAGADO") return "PAGADA"
	if (status === "VENCIDO") return "VENCIDA"
	if (status === "VENCIDA" || status === "PAGADA" || status === "PARCIAL") return status
	return "PENDIENTE"
}

function normalizeCreditDetail(raw: unknown): CreditDetail {
	const r = asRecord(raw)
	const status = typeof r.status === "string" ? r.status : ""
	return {
		id: toNumberSafe(r.id),
		saleId: toNumberSafe(r.saleId),
		saleCode: asString(r.saleCode),
		cliente: normalizeCliente(r.cliente),
		total: toNumberSafe(r.total),
		saldoPendiente: toNumberSafe(r.saldoPendiente),
		status: (status === "VENCIDOS" || status === "CANCELADO" ? status : "ACTIVO") as CreditStatus,
		installments: Array.isArray(r.installments) ? r.installments.map(normalizeInstallment) : [],
	}
}

export async function getCredits(): Promise<CreditListItem[]> {
	const data = await httpRequest<unknown>("/credits")
	if (!Array.isArray(data)) return []
	return data.map(normalizeCreditListItem)
}

export async function getCreditById(id: number): Promise<CreditDetail> {
	const data = await httpRequest<unknown>(`/credits/${id}`)
	return normalizeCreditDetail(data)
}

export async function payInstallment(installmentId: number, payload?: { amount?: number; paidAt?: string }): Promise<unknown> {
	return httpRequest(`/installments/${installmentId}/pay`, {
		method: "POST",
		body: payload ?? undefined,
	})
}

export async function getCreditDetalle(creditId: number): Promise<CreditDetailResponse> {
	return httpRequest<CreditDetailResponse>(`/creditos/${creditId}/detalle`)
}

export async function createCuotaPago(params: {
	creditoId: number
	cuotaId: number
	monto: number
	fecha: string
	metodo: PaymentMethod
	referencia?: string
	nota?: string
	pagarTodoCredito?: boolean
}): Promise<unknown> {
	return httpRequest(`/creditos/${params.creditoId}/cuotas/${params.cuotaId}/pagos`, {
		method: "POST",
		body: {
			monto: params.monto,
			fecha: params.fecha,
			metodo: params.metodo,
			referencia: params.referencia,
			nota: params.nota,
			pagarTodoCredito: params.pagarTodoCredito,
		},
	})
}

export const creditsApi = {
	// Nombres solicitados
	getCredits,
	getCreditById,
	payInstallment,
	getCreditDetalle,
	createCuotaPago,

	// Compat: nombres antiguos usados por algunas pantallas
	list: getCredits,
	getById: getCreditById,

	async exportCredits(params: { format: "pdf" | "xlsx" | "csv"; scope: "page" | "all"; ids?: number[] }): Promise<void> {
		const searchParams = new URLSearchParams()
		searchParams.set("format", params.format)
		searchParams.set("scope", params.scope)
		if (params.scope === "page" && params.ids && params.ids.length > 0) {
			searchParams.set("ids", params.ids.join(","))
		}

		const response = await api.get<Blob>(`/credits/export?${searchParams.toString()}`, {
			responseType: "blob",
		})

		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename =
			filenameFromContentDisposition(cd) ??
			(params.scope === "all" ? `creditos_all.${params.format}` : `creditos_page.${params.format}`)

		downloadBlob(response.data, { filename })
	},

	async exportSingleCreditPdf(creditId: number): Promise<void> {
		const response = await api.get<Blob>(`/credits/${creditId}/export`, {
			responseType: "blob",
		})
		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename = filenameFromContentDisposition(cd) ?? `credito_${creditId}.pdf`
		downloadBlob(response.data, { filename })
	},
}
