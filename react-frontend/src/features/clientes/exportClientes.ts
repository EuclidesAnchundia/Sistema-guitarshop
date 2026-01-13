import jsPDF from "jspdf"
import "jspdf-autotable"
import autoTable, { type UserOptions } from "jspdf-autotable"
import * as XLSX from "xlsx"

export type ExportRow = {
	"ID Cliente": string
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

export function exportToXLSX(rows: ExportRow[], baseName: string) {
	const worksheet = XLSX.utils.json_to_sheet(rows)
	const workbook = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
	XLSX.writeFile(workbook, `${baseName}.xlsx`)
}

export function exportToPDF(rows: ExportRow[], baseName: string) {
	const doc = new jsPDF()

	doc.setFontSize(16)
	doc.text("Lista de Clientes", 14, 20)

	const tableColumns = ["ID Cliente", "Nombre", "Cédula/RUC", "Correo", "Teléfono", "Dirección", "Fecha Registro"]
	const tableRows = rows.map(row => Object.values(row))

	const options: UserOptions = {
		head: [tableColumns],
		body: tableRows,
		startY: 30,
		styles: { fontSize: 8 },
		headStyles: { fillColor: [41, 128, 185] },
	}

	autoTable(doc, options)

	doc.save(`${baseName}.pdf`)
}