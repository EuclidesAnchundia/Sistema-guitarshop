export type ClienteRecord = {
	id_cliente: number
	nombres: string
	apellidos: string
	cedula: string
	correo: string | null
	telefono: string | null
	direccion: string | null
	fecha_registro: string
}

export type SortValue =
	| "name_asc"
	| "name_desc"
	| "date_asc"
	| "date_desc"
export type ClientesFilters = {
	orden: SortValue
	estado: "all" | "active" | "inactive"
	tipoId: "all" | "ruc" | "cedula"
	fechaDesde: string
	fechaHasta: string
}

export type ClientePayload = {
	nombres: string
	apellidos: string
	cedula: string
	correo: string | null
	telefono: string | null
	direccion: string | null
}