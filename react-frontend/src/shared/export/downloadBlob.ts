export type DownloadBlobOptions = {
	filename: string
	contentType?: string | null
}

export function downloadBlob(blob: Blob, options: DownloadBlobOptions) {
	const url = window.URL.createObjectURL(blob)
	try {
		const a = document.createElement("a")
		a.href = url
		a.download = options.filename
		a.rel = "noopener"
		a.style.display = "none"
		document.body.appendChild(a)
		a.click()
		a.remove()
	} finally {
		window.URL.revokeObjectURL(url)
	}
}
