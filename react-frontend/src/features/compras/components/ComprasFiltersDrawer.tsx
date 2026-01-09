"use client"

import type { Dispatch, SetStateAction } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"

export type ComprasFiltersDraft = {
	fechaDesde: string
	fechaHasta: string
	proveedor: string
	totalMin: string
	totalMax: string
}

type ProveedorOption = {
	id_proveedor: number
	nombre_proveedor: string
}

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	filtersDraft: ComprasFiltersDraft
	setFiltersDraft: Dispatch<SetStateAction<ComprasFiltersDraft>>

	proveedores: ProveedorOption[]

	onApply: () => void
	onCancel: () => void
	onClearDraft: () => void
}

export function ComprasFiltersDrawer(props: Props) {
	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">Filtros</DrawerTitle>
						<DrawerDescription>Refina el listado y aplica.</DrawerDescription>
					</DrawerHeader>

					<div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-6 py-5">
						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha desde</label>
							<input
								type="date"
								value={props.filtersDraft.fechaDesde}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({ ...prev, fechaDesde: event.target.value }))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha hasta</label>
							<input
								type="date"
								value={props.filtersDraft.fechaHasta}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({ ...prev, fechaHasta: event.target.value }))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</label>
							<select
								value={props.filtersDraft.proveedor}
								onChange={(event) => props.setFiltersDraft((prev) => ({ ...prev, proveedor: event.target.value }))}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="">Todos</option>
								{props.proveedores.map((prov) => (
									<option key={prov.id_proveedor} value={prov.nombre_proveedor}>
										{prov.nombre_proveedor}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total mínimo</label>
							<input
								type="number"
								step="0.01"
								min={0}
								value={props.filtersDraft.totalMin}
								onChange={(event) => props.setFiltersDraft((prev) => ({ ...prev, totalMin: event.target.value }))}
								placeholder="0.00"
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total máximo</label>
							<input
								type="number"
								step="0.01"
								min={0}
								value={props.filtersDraft.totalMax}
								onChange={(event) => props.setFiltersDraft((prev) => ({ ...prev, totalMax: event.target.value }))}
								placeholder="0.00"
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
						<button
							type="button"
							onClick={props.onCancel}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
						>
							Cancelar
						</button>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={props.onClearDraft}
								className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								Limpiar
							</button>
							<button
								type="button"
								onClick={props.onApply}
								className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
							>
								Aplicar
							</button>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}