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
			fecha_nacimiento: item.fecha_nacimiento ?? null,
		}))
	},

	async create(payload: ClientePayload): Promise<ClienteRecord> {
		// Asegurar formato YYYY-MM-DD si existe
		const body = { ...payload } as Partial<ClientePayload>
		if (body.fecha_nacimiento) {
			body.fecha_nacimiento = String(body.fecha_nacimiento).slice(0, 10)
		}
		const { data } = await api.post<ClienteRecord>("/cliente", body)
		return data
	},

	async update(clienteId: number, payload: ClientePayload): Promise<ClienteRecord> {
		const body = { ...payload } as Partial<ClientePayload>
		if (body.fecha_nacimiento) {
			body.fecha_nacimiento = String(body.fecha_nacimiento).slice(0, 10)
		}
		const { data } = await api.put<ClienteRecord>(`/cliente/${clienteId}`, body)
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