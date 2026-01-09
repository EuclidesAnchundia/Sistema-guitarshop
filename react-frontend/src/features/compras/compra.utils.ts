import type { CompraListRecord } from "./compra.types"

export function matchesCompraSearch(compra: CompraListRecord, search: string): boolean {
	if (!search.trim()) return true

	const searchLower = search.toLowerCase()
	return (
		compra.proveedor?.nombre_proveedor.toLowerCase().includes(searchLower) ||
		compra.id_compra.toString().includes(searchLower) ||
		compra.fecha_compra.includes(search)
	)
}