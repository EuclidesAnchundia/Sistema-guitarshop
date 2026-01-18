// Librerías pesadas cargadas bajo demanda

export type ExportRow = {
	"ID Proveedor": string
	"Nombre": string
	"Cédula/RUC": string
	"Correo": string
	"Teléfono": string
	"Dirección": string
	"Fecha Registro": string
}

export function exportToCSV(rows: ExportRow[], baseName: string) {
	const csvContent = [
		Object.keys(rows[0]).join(","),
		...rows.map(row => Object.values(row).map(value => `"${value}"`).join(","))
	].join("\n")

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
	const link = document.createElement("a")
	link.href = URL.createObjectURL(blob)
	link.download = `${baseName}.csv`
	link.click()
}

export async function exportToXLSX(rows: ExportRow[], baseName: string) {
	const XLSX = await import("xlsx")
	const worksheet = XLSX.utils.json_to_sheet(rows)
	const workbook = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(workbook, worksheet, "Proveedores")
	XLSX.writeFile(workbook, `${baseName}.xlsx`)
}

export async function exportToPDF(rows: ExportRow[], baseName: string) {
	const [{ default: jsPDF }, autoTableMod] = await Promise.all([
		import("jspdf"),
		import("jspdf-autotable").catch(() => null),
	])

	const doc = new jsPDF()

	doc.setFontSize(16)
	doc.text("Lista de Proveedores", 14, 20)

	const tableColumns = ["ID Proveedor", "Nombre", "Cédula/RUC", "Correo", "Teléfono", "Dirección", "Fecha Registro"]
	const tableRows = rows.map(row => Object.values(row))

	const autoTable = autoTableMod?.default as unknown as ((doc: unknown, opts: Record<string, unknown>) => void) | undefined
	if (autoTable) {
		autoTable(doc, {
			head: [tableColumns],
			body: tableRows,
			startY: 30,
			styles: { fontSize: 8 },
			headStyles: { fillColor: [41, 128, 185] },
		} as Record<string, unknown>)
	}

	doc.save(`${baseName}.pdf`)
}