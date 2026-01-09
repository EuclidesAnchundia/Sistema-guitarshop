import type { Dispatch, SetStateAction } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { CreditStatus } from "../../../services/creditsApi"

export type CreditsFilters = {
	status: "all" | CreditStatus
	soloVencidas: boolean
}

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	filtersDraft: CreditsFilters
	setFiltersDraft: Dispatch<SetStateAction<CreditsFilters>>

	onApply: () => void
	onCancel: () => void
	onClearDraft: () => void
}

export function CreditsFiltersDrawer(props: Props) {
	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">Filtros</DrawerTitle>
						<DrawerDescription>Refina el listado de créditos.</DrawerDescription>
					</DrawerHeader>

					<div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-6 py-5">
						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</label>
							<select
								value={props.filtersDraft.status}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										status: event.target.value as CreditsFilters["status"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								<option value="ACTIVO">ACTIVO</option>
								<option value="EN_MORA">EN_MORA</option>
								<option value="CANCELADO">CANCELADO</option>
							</select>
						</div>

						<div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
							<div>
								<p className="text-sm font-semibold text-slate-900">Solo con vencidas</p>
								<p className="text-xs text-slate-500">Muestra créditos que tienen al menos una cuota vencida.</p>
							</div>

							<label className="relative inline-flex cursor-pointer items-center">
								<input
									type="checkbox"
									checked={props.filtersDraft.soloVencidas}
									onChange={(event) =>
										props.setFiltersDraft((prev) => ({
											...prev,
											soloVencidas: event.target.checked,
										}))
									}
									className="peer sr-only"
								/>
								<span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-emerald-600" />
								<span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
							</label>
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
