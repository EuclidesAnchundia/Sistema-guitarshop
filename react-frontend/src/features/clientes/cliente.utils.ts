import type { ClienteRecord } from "./cliente.types"

export const getClienteFullName = (cliente: Pick<ClienteRecord, "nombres" | "apellidos">) => {
	return `${cliente.nombres} ${cliente.apellidos}`.trim()
}

export const matchesClienteSearch = (cliente: ClienteRecord, search: string) => {
	if (!search) return true
	const fullName = getClienteFullName(cliente).toLowerCase()
	const cedula = cliente.cedula.toLowerCase()
	const correo = cliente.correo?.toLowerCase() || ""
	const telefono = cliente.telefono?.toLowerCase() || ""
	const query = search.toLowerCase()
	return fullName.includes(query) || cedula.includes(query) || correo.includes(query) || telefono.includes(query)
}

// Calcula la próxima fecha de corte basada en la fecha de nacimiento.
// - `fechaNacimiento`: string (YYYY-MM-DD) o Date
// - `fechaRef`: referencia (por defecto hoy)
// Reglas:
// - día de corte = day(fechaNacimiento)
// - si ese día ya pasó en el mes actual (day < today.day) => corte el próximo mes
// - si no pasó (day >= today.day) => corte este mes
// - si el mes objetivo no tiene ese día (ej. 31 en febrero), usar el último día del mes
export function getFechaCorte(fechaNacimiento: string | Date, fechaRef: Date = new Date()): Date {
 	// Parse fechaNacimiento as local date (avoid 'YYYY-MM-DD' -> UTC parsing)
 	let nacimientoDate: Date | null = null
 	if (typeof fechaNacimiento === "string") {
 		const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(fechaNacimiento)
 		if (m) {
 			nacimientoDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
 		} else {
 			const p = new Date(fechaNacimiento)
 			if (!Number.isNaN(p.getTime())) nacimientoDate = new Date(p.getFullYear(), p.getMonth(), p.getDate())
 		}
 	} else {
 		nacimientoDate = new Date(fechaNacimiento.getFullYear(), fechaNacimiento.getMonth(), fechaNacimiento.getDate())
 	}
 	if (!nacimientoDate) {
 		throw new Error("FECHA_NACIMIENTO_INVALIDA")
 	}
 	const dia = nacimientoDate.getDate()

 	const ref = new Date(fechaRef)
 	ref.setHours(0, 0, 0, 0)

 	const hoyDia = ref.getDate()

 	// determinar mes/año candidato
 	let targetMonth = ref.getMonth()
 	let targetYear = ref.getFullYear()

 	if (dia < hoyDia) {
 		// ya pasó este mes -> siguiente mes
 		targetMonth += 1
 		if (targetMonth > 11) {
 			targetMonth = 0
 			targetYear += 1
 		}
 	}

 	// obtener último día del mes objetivo
 	const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
 	const corteDay = Math.min(dia, lastDayOfTargetMonth)

 	return new Date(targetYear, targetMonth, corteDay)
}