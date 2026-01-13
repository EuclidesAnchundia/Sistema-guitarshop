import { api } from "../../lib/apiClient"
import type {
	ProductoPayload,
	ProductoRecord,
	KardexMovimientoRecord,
	ProductSalesSummary,
	ProveedorRecord,
	VentaDetailRecord,
	VentaListRecord,
} from "./product.types"

const SALES_CONCURRENCY = 6

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function toNumberOr(value: unknown, fallback = 0): number {
	const parsed = typeof value === "number" ? value : Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null
	const parsed = typeof value === "number" ? value : Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

export const productClient = {
	async list(): Promise<ProductoRecord[]> {
		const { data } = await api.get<ProductoRecord[]>("/producto")
		if (!Array.isArray(data)) return []
		return data.map((item) => ({
			...item,
			precio_compra: toNumberOr(asRecord(item).precio_compra, 0),
			precio_venta: toNumberOr(asRecord(item).precio_venta, 0),
			costo: (() => {
				return toNullableNumber(asRecord(item).costo)
			})(),
			margen: (() => {
				return toNullableNumber(asRecord(item).margen)
			})(),
			proveedor_nombre: (() => {
				const value = asRecord(item).proveedor_nombre
				return typeof value === "string" ? value : null
			})(),
			cantidad_stock: toNumberOr(asRecord(item).cantidad_stock, 0),
			stock_minimo: toNumberOr(asRecord(item).stock_minimo, 0),
		}))
	},

	async listProviders(): Promise<ProveedorRecord[]> {
		const { data } = await api.get<ProveedorRecord[]>("/proveedor")
		return Array.isArray(data) ? data : []
	},

	async listImages(): Promise<Record<number, string>> {
		const { data } = await api.get<Record<string, string>>("/producto/imagen")
		const resolved: Record<number, string> = {}
		if (data && typeof data === "object") {
			Object.entries(data).forEach(([key, value]) => {
				const parsed = Number(key)
				if (Number.isFinite(parsed) && typeof value === "string") {
					resolved[parsed] = value
				}
			})
		}
		return resolved
	},

	async saveImage(productId: number, imageUrl: string | null): Promise<void> {
		await api.post("/producto/imagen", {
			id_producto: productId,
			imagen_url: imageUrl,
		})
	},

	async create(payload: ProductoPayload): Promise<ProductoRecord> {
		const { data } = await api.post<ProductoRecord>("/producto", payload)
		return data
	},

	async update(productId: number, payload: ProductoPayload): Promise<ProductoRecord> {
		const { data } = await api.put<ProductoRecord>(`/producto/${productId}`, payload)
		return data
	},

	async remove(productId: number): Promise<void> {
		await api.delete(`/producto/${productId}`)
	},

	async listVentas(): Promise<VentaListRecord[]> {
		const { data } = await api.get<VentaListRecord[]>("/ventas")
		return Array.isArray(data) ? data : []
	},

	async getVentaDetail(ventaId: number): Promise<VentaDetailRecord> {
		const { data } = await api.get<VentaDetailRecord>(`/ventas/${ventaId}`)
		return data
	},

	async getSalesSummary(productId: number): Promise<ProductSalesSummary> {
		if (!productId) {
			return { totalUnitsSold: 0, last30DaysUnitsSold: 0, lastSaleDate: null, recentLines: [] }
		}

		const ventas = await this.listVentas()
		const ordered = [...ventas].sort((a, b) => new Date(b.fecha_factura).getTime() - new Date(a.fecha_factura).getTime())

		let totalUnitsSold = 0
		let last30DaysUnitsSold = 0
		let lastSaleDate: string | null = null
		const recentLines: ProductSalesSummary["recentLines"] = []

		const now = Date.now()
		const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

		for (let i = 0; i < ordered.length; i += SALES_CONCURRENCY) {
			const chunk = ordered.slice(i, i + SALES_CONCURRENCY)
			const details = await Promise.all(
				chunk.map(async (venta) => {
					try {
						return await this.getVentaDetail(venta.id_factura)
					} catch {
						return null
					}
				})
			)

			for (const ventaDetalle of details) {
				if (!ventaDetalle) continue
				const matches = ventaDetalle.detalle_factura.filter((d) => d.id_producto === productId)
				if (matches.length === 0) continue
				if (!lastSaleDate) lastSaleDate = ventaDetalle.fecha_factura

				const saleTime = new Date(ventaDetalle.fecha_factura).getTime()
				const isLast30Days = now - saleTime <= THIRTY_DAYS_MS

				for (const detalle of matches) {
					totalUnitsSold += detalle.cantidad
					if (isLast30Days) last30DaysUnitsSold += detalle.cantidad

					if (recentLines.length < 10) {
						recentLines.push({
							id_factura: ventaDetalle.id_factura,
							numero_factura: ventaDetalle.numero_factura,
							fecha_factura: ventaDetalle.fecha_factura,
							cantidad: detalle.cantidad,
							precio_unitario: detalle.precio_unitario,
							subtotal: detalle.subtotal,
						})
					}
				}
			}
		}

		return { totalUnitsSold, last30DaysUnitsSold, lastSaleDate, recentLines }
	},

	async listKardex(): Promise<KardexMovimientoRecord[]> {
		const { data } = await api.get<KardexMovimientoRecord[]>("/kardex")
		if (!Array.isArray(data)) return []
		return data.map((item) => ({
			...item,
			id_kardex: toNumberOr(asRecord(item).id_kardex, 0),
			id_producto: toNumberOr(asRecord(item).id_producto, 0),
			id_referencia: (() => {
				const value = asRecord(item).id_referencia
				if (value === null || value === undefined) return null
				return toNumberOr(value, 0)
			})(),
			cantidad: toNumberOr(asRecord(item).cantidad, 0),
			costo_unitario: toNullableNumber(asRecord(item).costo_unitario),
		}))
	},
}
