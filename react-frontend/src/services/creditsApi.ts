import { httpRequest } from "./httpClient"
import { toNumberSafe } from "../utils/number"

export type CreditStatus = "ACTIVO" | "EN_MORA" | "CANCELADO"
export type InstallmentStatus = "PENDIENTE" | "VENCIDA" | "PAGADA"

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

function normalizeCliente(raw: any): ClienteMini {
	return {
		id_cliente: toNumberSafe(raw?.id_cliente),
		nombres: String(raw?.nombres ?? ""),
		apellidos: String(raw?.apellidos ?? ""),
		cedula: String(raw?.cedula ?? ""),
	}
}

function normalizeNextInstallment(raw: any): NextInstallment {
	return {
		id: toNumberSafe(raw?.id),
		number: toNumberSafe(raw?.number),
		dueDate: String(raw?.dueDate ?? ""),
		amount: toNumberSafe(raw?.amount),
		status: (raw?.status === "VENCIDA" || raw?.status === "PAGADA" ? raw.status : "PENDIENTE") as InstallmentStatus,
	}
}

function normalizeCreditListItem(raw: any): CreditListItem {
	return {
		id: toNumberSafe(raw?.id),
		sale: {
			id: toNumberSafe(raw?.sale?.id),
			code: String(raw?.sale?.code ?? ""),
		},
		saldoPendiente: toNumberSafe(raw?.saldoPendiente),
		status: (raw?.status === "EN_MORA" || raw?.status === "CANCELADO" ? raw.status : "ACTIVO") as CreditStatus,
		cliente: normalizeCliente(raw?.cliente),
		nextInstallment: raw?.nextInstallment ? normalizeNextInstallment(raw.nextInstallment) : null,
	}
}

function normalizeInstallment(raw: any): CreditInstallment {
	return {
		id: toNumberSafe(raw?.id),
		number: toNumberSafe(raw?.number),
		dueDate: String(raw?.dueDate ?? ""),
		amount: toNumberSafe(raw?.amount),
		paidAmount: toNumberSafe(raw?.paidAmount),
		status: (raw?.status === "VENCIDA" || raw?.status === "PAGADA" ? raw.status : "PENDIENTE") as InstallmentStatus,
		paidAt: raw?.paidAt ? String(raw.paidAt) : null,
	}
}

function normalizeCreditDetail(raw: any): CreditDetail {
	return {
		id: toNumberSafe(raw?.id),
		saleId: toNumberSafe(raw?.saleId),
		saleCode: String(raw?.saleCode ?? ""),
		cliente: normalizeCliente(raw?.cliente),
		total: toNumberSafe(raw?.total),
		saldoPendiente: toNumberSafe(raw?.saldoPendiente),
		status: (raw?.status === "EN_MORA" || raw?.status === "CANCELADO" ? raw.status : "ACTIVO") as CreditStatus,
		installments: Array.isArray(raw?.installments) ? raw.installments.map(normalizeInstallment) : [],
	}
}

export async function getCredits(): Promise<CreditListItem[]> {
	const data = await httpRequest<any>("/credits")
	if (!Array.isArray(data)) return []
	return data.map(normalizeCreditListItem)
}

export async function getCreditById(id: number): Promise<CreditDetail> {
	const data = await httpRequest<any>(`/credits/${id}`)
	return normalizeCreditDetail(data)
}

export async function payInstallment(installmentId: number, payload?: { amount?: number; paidAt?: string }): Promise<unknown> {
	return httpRequest(`/installments/${installmentId}/pay`, {
		method: "POST",
		body: payload ?? undefined,
	})
}

export const creditsApi = {
	// Nombres solicitados
	getCredits,
	getCreditById,
	payInstallment,

	// Compat: nombres antiguos usados por algunas pantallas
	list: getCredits,
	getById: getCreditById,
}
