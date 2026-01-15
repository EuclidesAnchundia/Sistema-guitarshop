import { api } from "../../lib/apiClient"
import { filenameFromContentDisposition } from "../../shared/export/contentDisposition"
import { downloadBlob } from "../../shared/export/downloadBlob"
import type { CompraDetailRecord, CompraListRecord, CompraPayload } from "./compra.types"

export const compraClient = {
	async getAll(): Promise<CompraListRecord[]> {
		const response = await api.get("/compra")
		return response.data
	},

	async getById(id: number): Promise<CompraDetailRecord> {
		const response = await api.get(`/compra/${id}`)
		return response.data
	},

	async create(payload: CompraPayload): Promise<CompraDetailRecord> {
		const response = await api.post("/compra", payload)
		return response.data
	},

	async update(id: number, payload: CompraPayload): Promise<CompraDetailRecord> {
		const response = await api.put(`/compra/${id}`, payload)
		return response.data
	},

	async remove(id: number): Promise<void> {
		await api.delete(`/compra/${id}`)
	},

	async exportCompras(params: { format: "pdf" | "xlsx" | "csv"; scope: "page" | "all"; ids?: number[] }): Promise<void> {
		const searchParams = new URLSearchParams()
		searchParams.set("format", params.format)
		searchParams.set("scope", params.scope)
		if (params.scope === "page" && params.ids && params.ids.length > 0) {
			searchParams.set("ids", params.ids.join(","))
		}

		const response = await api.get<Blob>(`/compra/export?${searchParams.toString()}`, {
			responseType: "blob",
		})

		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename =
			filenameFromContentDisposition(cd) ??
			(params.scope === "all" ? `compras_all.${params.format}` : `compras_page.${params.format}`)

		downloadBlob(response.data, { filename })
	},

	async exportSingleCompraPdf(compraId: number): Promise<void> {
		const response = await api.get<Blob>(`/compra/${compraId}/export`, {
			responseType: "blob",
		})
		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename = filenameFromContentDisposition(cd) ?? `compra_${compraId}.pdf`
		downloadBlob(response.data, { filename })
	},
}