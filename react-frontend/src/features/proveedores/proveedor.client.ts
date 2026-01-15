import { api } from "../../lib/apiClient"
import { filenameFromContentDisposition } from "../../shared/export/contentDisposition"
import { downloadBlob } from "../../shared/export/downloadBlob"
import type { ProveedorPayload, ProveedorRecord } from "./proveedor.types"

export const proveedorClient = {
	async list(): Promise<ProveedorRecord[]> {
		const { data } = await api.get<ProveedorRecord[]>("/proveedor")
		if (!Array.isArray(data)) return []
		return data.map((item) => ({
			...item,
			fecha_registro: item.fecha_registro || new Date().toISOString(),
		}))
	},

	async create(payload: ProveedorPayload): Promise<ProveedorRecord> {
		const { data } = await api.post<ProveedorRecord>("/proveedor", payload)
		return data
	},

	async update(proveedorId: number, payload: ProveedorPayload): Promise<ProveedorRecord> {
		const { data } = await api.put<ProveedorRecord>(`/proveedor/${proveedorId}`, payload)
		return data
	},

	async remove(proveedorId: number): Promise<void> {
		await api.delete(`/proveedor/${proveedorId}`)
	},

	async exportProveedores(params: { format: "pdf" | "xlsx" | "csv"; scope: "page" | "all"; ids?: number[] }): Promise<void> {
		const searchParams = new URLSearchParams()
		searchParams.set("format", params.format)
		searchParams.set("scope", params.scope)
		if (params.scope === "page" && params.ids && params.ids.length > 0) {
			searchParams.set("ids", params.ids.join(","))
		}

		const response = await api.get<Blob>(`/proveedor/export?${searchParams.toString()}`, {
			responseType: "blob",
		})

		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename =
			filenameFromContentDisposition(cd) ??
			(params.scope === "all" ? `proveedores_all.${params.format}` : `proveedores_page.${params.format}`)

		downloadBlob(response.data, { filename })
	},

	async exportSingleProveedorPdf(proveedorId: number): Promise<void> {
		const response = await api.get<Blob>(`/proveedor/${proveedorId}/export`, {
			responseType: "blob",
		})
		const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
		const filename = filenameFromContentDisposition(cd) ?? `proveedor_${proveedorId}.pdf`
		downloadBlob(response.data, { filename })
	},
}