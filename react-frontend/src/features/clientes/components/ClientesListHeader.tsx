import { useEffect, useRef, useState } from "react"
import { ChevronDown, Download, Search, SlidersHorizontal } from "lucide-react"

export type ClientesFilterChip = {
	key: "orden"
	label: string
}

type Props = {
	startItem: number
	endItem: number
	resultsCount: number

	searchInput: string
	onSearchInputChange: (next: string) => void

	onOpenFilters: () => void

	onExport: (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv" }) => void
	exportingKey: string | null

	filterChips: ClientesFilterChip[]
	onRemoveChip: (key: ClientesFilterChip["key"]) => void
	onClearAllFilters: () => void
}

export function ClientesListHeader(props: Props) {
	const [exportOpen, setExportOpen] = useState(false)
	const exportRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const handler = (event: MouseEvent) => {
			const el = exportRef.current
			if (!el) return
			if (!el.contains(event.target as Node)) {
				setExportOpen(false)
			}
		}
		document.addEventListener("click", handler)
		return () => document.removeEventListener("click", handler)
	}, [])

	const disabled = props.exportingKey !== null

	return (
		<div className="px-6 py-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<p id="clientes-listado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Listado
					</p>
					<p className="mt-1 text-sm font-semibold text-slate-900">Clientes</p>
					<p className="text-xs text-slate-500">
						Mostrando {props.startItem}-{props.endItem} de {props.resultsCount} resultados.
					</p>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
					<div className="relative w-full flex-1 sm:min-w-[300px] md:min-w-[360px] lg:min-w-[420px]">
						<Search
							className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
							aria-hidden="true"
						/>
						<input
							value={props.searchInput}
							onChange={(event) => props.onSearchInputChange(event.target.value)}
							placeholder="Buscar por nombre, cédula o correo"
							className="w-full rounded-2xl border border-slate-200 py-2.5 pl-11 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<button
						type="button"
						onClick={props.onOpenFilters}
						disabled={disabled}
						className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						<SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
						Filtros
					</button>

					{/* Orden: control removed (handled in filtros) */}

					<div className="relative" ref={exportRef}>
						<button
							type="button"
							onClick={() => setExportOpen((prev) => !prev)}
							disabled={disabled}
							className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
							aria-haspopup="menu"
							aria-expanded={exportOpen}
						>
							<Download className="h-4 w-4 text-slate-500" aria-hidden="true" />
							Exportar
							<ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
						</button>

						{exportOpen && (
							<div className="absolute right-0 z-20 mt-2 w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
								<div className="space-y-3">
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Página actual</p>
										<div className="mt-2 grid grid-cols-3 gap-2">
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "page", format: "pdf" })
												}}
												disabled={disabled}
												aria-label="PDF (Página actual)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												PDF
											</button>
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "page", format: "xlsx" })
												}}
												disabled={disabled}
												aria-label="Excel (Página actual)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												Excel
											</button>
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "page", format: "csv" })
												}}
												disabled={disabled}
												aria-label="CSV (Página actual)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												CSV
											</button>
										</div>
									</div>

									<div className="h-px bg-slate-100" />

									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Todos (registro completo)</p>
										<div className="mt-2 grid grid-cols-3 gap-2">
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "all", format: "pdf" })
												}}
												disabled={disabled}
												aria-label="PDF (Todos)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												PDF
											</button>
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "all", format: "xlsx" })
												}}
												disabled={disabled}
												aria-label="Excel (Todos)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												Excel
											</button>
											<button
												type="button"
												onClick={() => {
													setExportOpen(false)
													props.onExport({ scope: "all", format: "csv" })
												}}
												disabled={disabled}
												aria-label="CSV (Todos)"
												className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
											>
												CSV
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{props.filterChips.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{props.filterChips.map((chip) => (
						<span
							key={chip.key}
							className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
						>
							{chip.label}
							<button
								type="button"
								onClick={() => props.onRemoveChip(chip.key)}
								className="rounded-full px-1 text-slate-500 hover:text-slate-900"
								aria-label="Remover filtro"
							>
								×
							</button>
						</span>
					))}
					<button
						type="button"
						onClick={props.onClearAllFilters}
						className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Limpiar todo
					</button>
				</div>
			)}
		</div>
	)
}