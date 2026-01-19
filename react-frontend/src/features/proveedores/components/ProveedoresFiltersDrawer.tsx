import type { Dispatch, SetStateAction } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { ProveedoresFilters } from "../proveedor.types"
import SortFieldDirection from "../../../components/SortFieldDirection"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	filtersDraft: ProveedoresFilters
	setFiltersDraft: Dispatch<SetStateAction<ProveedoresFilters>>

	onApply: () => void
	onCancel: () => void
	onClearDraft: () => void
}

export function ProveedoresFiltersDrawer(props: Props) {
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
							<SortFieldDirection
								value={props.filtersDraft.orden}
								onChange={(val: string) => props.setFiltersDraft((prev) => ({ ...prev, orden: val as ProveedoresFilters["orden"] }))}
								fields={[{ value: "name", label: "Nombre" }, { value: "date", label: "Fecha" }]}
							/>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</label>
							<select
								value={props.filtersDraft.estado}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										estado: event.target.value as ProveedoresFilters["estado"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								<option value="active">Activo</option>
								<option value="inactive">Inactivo</option>
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de identificación</label>
							<select
								value={props.filtersDraft.tipoId}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										tipoId: event.target.value as ProveedoresFilters["tipoId"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								<option value="ruc">RUC</option>
								<option value="cedula">Cédula</option>
							</select>
						</div>



						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de registro</label>
							<div className="mt-1 grid gap-3 sm:grid-cols-2">
								<div>
									<p className="text-xs font-semibold text-slate-600">Desde</p>
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
									<p className="text-xs font-semibold text-slate-600">Hasta</p>
									<input
										type="date"
										value={props.filtersDraft.fechaHasta}
										onChange={(event) =>
											props.setFiltersDraft((prev) => ({ ...prev, fechaHasta: event.target.value }))
										}
										className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
									/>
								</div>
							</div>
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