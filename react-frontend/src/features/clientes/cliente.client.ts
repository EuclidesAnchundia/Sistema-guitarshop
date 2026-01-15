import { api } from "../../lib/apiClient"
import { filenameFromContentDisposition } from "../../shared/export/contentDisposition"
import { downloadBlob } from "../../shared/export/downloadBlob"
import type { ClientePayload, ClienteRecord } from "./cliente.types"

export const clienteClient = {
	async list(): Promise<ClienteRecord[]> {
		const { data } = await api.get<ClienteRecord[]>("/cliente")
		if (!Array.isArray(data)) return []
		return data.map((item) => ({
			...item,
			fecha_registro: item.fecha_registro || new Date().toISOString(),
		}))
	},

	async create(payload: ClientePayload): Promise<ClienteRecord> {
		const { data } = await api.post<ClienteRecord>("/cliente", payload)
		return data
	},

	async update(clienteId: number, payload: ClientePayload): Promise<ClienteRecord> {
		const { data } = await api.put<ClienteRecord>(`/cliente/${clienteId}`, payload)
		return data
	},

	async remove(clienteId: number): Promise<void> {
		await api.delete(`/cliente/${clienteId}`)
	},

	async exportClientes(params: { format: "pdf" | "xlsx" | "csv"; scope: "page" | "all"; ids?: number[] }): Promise<void> {
		const searchParams = new URLSearchParams()
		searchParams.set("format", params.format)
		searchParams.set("scope", params.scope)
		if (params.scope === "page" && params.ids && params.ids.length > 0) {
			searchParams.set("ids", params.ids.join(","))
		}

		const response = await api.get<Blob>(`/cliente/export?${searchParams.toString()}`, {
			responseType: "blob",
		})

		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename =
			filenameFromContentDisposition(cd) ??
			(params.scope === "all" ? `clientes_all.${params.format}` : `clientes_page.${params.format}`)

		downloadBlob(response.data, { filename })
	},

	async exportSingleClientePdf(clienteId: number): Promise<void> {
		const response = await api.get<Blob>(`/cliente/${clienteId}/export`, {
			responseType: "blob",
		})

		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename = filenameFromContentDisposition(cd) ?? `cliente_${clienteId}.pdf`
		downloadBlob(response.data, { filename })
	},
}