export type ProveedorRecord = {
	id_proveedor: number
	nombre_proveedor: string
	ruc_cedula: string
	correo: string | null
	telefono: string | null
	direccion: string | null
	fecha_registro: string
	// El backend expone id_estado, pero el UI debe ser tolerante si no viene.
	id_estado?: number
}

export type SortValue =
	| "name_asc"
	| "name_desc"
	| "date_asc"
	| "date_desc"

export type ProveedorEstadoFilter = "all" | "active" | "inactive"
export type ProveedorIdTypeFilter = "all" | "ruc" | "cedula"

export type ProveedoresFilters = {
	estado: ProveedorEstadoFilter
	tipoId: ProveedorIdTypeFilter
	fechaDesde: string
	fechaHasta: string
	orden: SortValue
}

export type ProveedorPayload = {
	nombre_proveedor: string
	ruc_cedula: string
	correo: string | null
	telefono: string | null
	direccion: string | null
}