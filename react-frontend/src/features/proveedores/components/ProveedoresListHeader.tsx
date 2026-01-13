import type { ProveedoresViewMode } from "../proveedor.types"

export type ProveedoresFilterChip = {
	key: "estado" | "tipoId" | "fecha" | "orden"
	label: string
}

type Props = {
	startItem: number
	endItem: number
	resultsCount: number

	searchInput: string
	onSearchInputChange: (next: string) => void

	onOpenFilters: () => void

	viewMode: ProveedoresViewMode
	onChangeViewMode: (next: ProveedoresViewMode) => void

	pageSize: number
	onChangePageSize: (next: number) => void

	onOpenCreate: () => void
	createDisabled?: boolean

	onOpenExport: () => void

	filterChips: ProveedoresFilterChip[]
	onRemoveChip: (key: ProveedoresFilterChip["key"]) => void
	onClearAllFilters: () => void
}

import { Search, SlidersHorizontal } from "lucide-react"

export function ProveedoresListHeader(props: Props) {
	return (
		<div className="px-6 py-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<p id="proveedores-listado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Listado
					</p>
					<p className="mt-1 text-sm font-semibold text-slate-900">Proveedores</p>
					<p className="text-xs text-slate-500">
						Mostrando {props.startItem}-{props.endItem} de {props.resultsCount} resultados.
					</p>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
					<input
						value={props.searchInput}
						onChange={(e) => props.onSearchInputChange(e.target.value)}
						placeholder="Buscar por nombre, RUC, correo..."
						className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
					/>

					<div className="flex items-center gap-2">
						<button
							onClick={props.onOpenFilters}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
						>
							Filtros
							{props.filterChips.length > 0 && (
								<span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
									{props.filterChips.length}
								</span>
							)}
						</button>

						<div className="flex items-center rounded-md border border-slate-200 p-1">
							<button
								onClick={() => props.onChangeViewMode("table")}
								className={`inline-flex h-7 w-7 items-center justify-center rounded-sm text-sm font-medium transition-colors ${
									props.viewMode === "table"
										? "bg-slate-900 text-white"
										: "text-slate-700 hover:bg-slate-100"
								}`}
							>
								<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
								</svg>
							</button>
							<button
								onClick={() => props.onChangeViewMode("cards")}
								className={`inline-flex h-7 w-7 items-center justify-center rounded-sm text-sm font-medium transition-colors ${
									props.viewMode === "cards"
										? "bg-slate-900 text-white"
										: "text-slate-700 hover:bg-slate-100"
								}`}
							>
								<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
							</button>
						</div>

						<select
							value={props.pageSize}
							onChange={(e) => props.onChangePageSize(Number(e.target.value))}
							className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
						>
							<option value={10}>10 por página</option>
							<option value={25}>25 por página</option>
							<option value={50}>50 por página</option>
							<option value={100}>100 por página</option>
						</select>

						<button
							onClick={props.onOpenExport}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50"
						>
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Exportar
						</button>

						<button
							onClick={props.onOpenCreate}
							disabled={props.createDisabled}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white shadow transition-colors hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50"
						>
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
							</svg>
							Nuevo Proveedor
						</button>
					</div>
				</div>
			</div>

			{props.filterChips.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium text-slate-500">Filtros activos:</span>
					{props.filterChips.map((chip) => (
						<button
							key={chip.key}
							onClick={() => props.onRemoveChip(chip.key)}
							className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
						>
							{chip.label}
							<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					))}
					<button
						onClick={props.onClearAllFilters}
						className="text-xs font-medium text-slate-500 hover:text-slate-700"
					>
						Limpiar todos
					</button>
				</div>
			)}
		</div>
	)
}