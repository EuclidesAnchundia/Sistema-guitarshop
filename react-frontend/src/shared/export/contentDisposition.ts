export function filenameFromContentDisposition(headerValue: string | null | undefined): string | null {
	if (!headerValue) return null
	// Ej: attachment; filename="productos_all.pdf"
	const match = headerValue.match(/filename\*=UTF-8''([^;]+)|filename="?([^;"]+)"?/i)
	if (!match) return null
	const raw = (match[1] ?? match[2] ?? "").trim()
	if (!raw) return null
	try {
		return decodeURIComponent(raw)
	} catch {
		return raw
	}
}
