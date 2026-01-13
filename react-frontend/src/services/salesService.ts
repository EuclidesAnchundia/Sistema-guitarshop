import { httpRequest } from "./httpClient"
import { toNumberSafe } from "../utils/number"

export type FormaPago = "CONTADO" | "CREDITO"

export type VentaListRecord = {
	id_factura: number
	numero_factura: string
	fecha_factura: string
	forma_pago: FormaPago
	observacion: string | null
	subtotal: number
	impuesto: number
	total: number
	id_estado: number
	cliente: {
		id_cliente: number
		nombres: string
		apellidos: string
		cedula: string
	} | null
	usuario: {
		id_usuario: number
		nombre_completo: string
	} | null
}

export type VentaDetailRecord = VentaListRecord & {
	detalle_factura: Array<{
		id_detalle_factura: number
		id_producto: number
		cantidad: number
		precio_unitario: number
		descuento: number
		subtotal: number
		producto: {
			codigo_producto: string
			nombre_producto: string
		}
	}>
	credito: {
		id_credito: number
		monto_total: number
		saldo_pendiente: number
		fecha_inicio: string
		fecha_fin: string | null
		cuota: Array<{
			id_cuota: number
			numero_cuota: number
			fecha_vencimiento: string
			monto_cuota: number
			monto_pagado: number
			estado_cuota: string
		}>
	} | null
}

export type VentaPayload = {
	id_cliente: number | null
	forma_pago: FormaPago
	observacion: string | null
	detalle: Array<{
		id_producto: number
		cantidad: number
		precio_unitario: number
		descuento: number
	}>
	creditoConfig?: {
		numero_cuotas: number
		fecha_primer_vencimiento: string
		dias_entre_cuotas?: number
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ""): string {
	if (typeof value === "string") return value
	if (value === null || value === undefined) return fallback
	return String(value)
}

function normalizeVentaListItem(raw: unknown): VentaListRecord {
	const r = asRecord(raw)
	const clienteRaw = r.cliente
	const usuarioRaw = r.usuario
	const cliente = (() => {
		const c = asRecord(clienteRaw)
		if (!clienteRaw || typeof clienteRaw !== "object") return null
		return {
			id_cliente: toNumberSafe(c.id_cliente),
			nombres: asString(c.nombres),
			apellidos: asString(c.apellidos),
			cedula: asString(c.cedula),
		}
	})()
	const usuario = (() => {
		const u = asRecord(usuarioRaw)
		if (!usuarioRaw || typeof usuarioRaw !== "object") return null
		return {
			id_usuario: toNumberSafe(u.id_usuario),
			nombre_completo: asString(u.nombre_completo),
		}
	})()

	return {
		id_factura: toNumberSafe(r.id_factura),
		numero_factura: asString(r.numero_factura),
		fecha_factura: asString(r.fecha_factura),
		forma_pago: (r.forma_pago === "CREDITO" ? "CREDITO" : "CONTADO") as FormaPago,
		observacion: r.observacion === null || r.observacion === undefined ? null : asString(r.observacion),
		subtotal: toNumberSafe(r.subtotal),
		impuesto: toNumberSafe(r.impuesto),
		total: toNumberSafe(r.total),
		id_estado: toNumberSafe(r.id_estado),
		cliente,
		usuario,
	}
}

function normalizeVentaDetail(raw: unknown): VentaDetailRecord {
	const r = asRecord(raw)
	const header = normalizeVentaListItem(raw)
	const detalleRaw = Array.isArray(r.detalle_factura) ? r.detalle_factura : []
	const detalle = detalleRaw.map((d) => {
		const dr = asRecord(d)
		const productoRaw = dr.producto
		const pr = asRecord(productoRaw)
		return {
			id_detalle_factura: toNumberSafe(dr.id_detalle_factura),
			id_producto: toNumberSafe(dr.id_producto),
			cantidad: toNumberSafe(dr.cantidad),
			precio_unitario: toNumberSafe(dr.precio_unitario),
			descuento: toNumberSafe(dr.descuento),
			subtotal: toNumberSafe(dr.subtotal),
			producto: {
				codigo_producto: asString(pr.codigo_producto),
				nombre_producto: asString(pr.nombre_producto),
			},
		}
	})

	const creditoRaw = r.credito
	type CreditoShape = VentaDetailRecord["credito"]
	const credito: CreditoShape = (() => {
		if (!creditoRaw || typeof creditoRaw !== "object") return null
		const c = asRecord(creditoRaw)
		const cuotaRaw = Array.isArray(c.cuota) ? c.cuota : []
		return {
			id_credito: toNumberSafe(c.id_credito),
			monto_total: toNumberSafe(c.monto_total),
			saldo_pendiente: toNumberSafe(c.saldo_pendiente),
			fecha_inicio: asString(c.fecha_inicio),
			fecha_fin: c.fecha_fin === null || c.fecha_fin === undefined ? null : asString(c.fecha_fin),
			cuota: cuotaRaw.map((cuota) => {
				const cr = asRecord(cuota)
				return {
					id_cuota: toNumberSafe(cr.id_cuota),
					numero_cuota: toNumberSafe(cr.numero_cuota),
					fecha_vencimiento: asString(cr.fecha_vencimiento),
					monto_cuota: toNumberSafe(cr.monto_cuota),
					monto_pagado: toNumberSafe(cr.monto_pagado),
					estado_cuota: asString(cr.estado_cuota),
				}
			}),
		}
	})()

	return {
		...header,
		detalle_factura: detalle,
		credito,
	}
}

export const salesService = {
	async listSales(): Promise<VentaListRecord[]> {
		const data = await httpRequest<unknown>("/ventas")
		if (!Array.isArray(data)) return []
		return data.map(normalizeVentaListItem)
	},

	async getSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<unknown>(`/ventas/${id}`)
		return normalizeVentaDetail(data)
	},

	async createSale(payload: VentaPayload): Promise<VentaDetailRecord> {
		const data = await httpRequest<unknown>("/ventas", { method: "POST", body: payload })
		return normalizeVentaDetail(data)
	},

	async updateSale(id: number, payload: { observacion: string | null }): Promise<VentaDetailRecord> {
		const data = await httpRequest<unknown>(`/ventas/${id}`, { method: "PUT", body: payload })
		return normalizeVentaDetail(data)
	},

	async cancelSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<unknown>(`/ventas/${id}`, { method: "DELETE" })
		return normalizeVentaDetail(data)
	},

	async reactivateSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<unknown>(`/ventas/${id}/reactivar`, { method: "POST" })
		return normalizeVentaDetail(data)
	},
}
