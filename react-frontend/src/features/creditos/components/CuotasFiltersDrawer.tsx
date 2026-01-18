import type { Dispatch, SetStateAction } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"

export type CuotasFilters = {
  status: "all" | "PENDIENTE" | "PAGADA" | "VENCIDA"
  dateFrom: string | null
  dateTo: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void

  filtersDraft: CuotasFilters
  setFiltersDraft: Dispatch<SetStateAction<CuotasFilters>>

  onApply: () => void
  onCancel: () => void
  onClearDraft: () => void
}

export function CuotasFiltersDrawer(props: Props) {
  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent className="overflow-hidden">
        <div className="flex h-dvh flex-col">
          <DrawerHeader>
            <DrawerTitle className="pr-10">Filtros</DrawerTitle>
            <DrawerDescription>Refina el listado de cuotas.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</label>
              <select
                value={props.filtersDraft.status}
                onChange={(event) =>
                  props.setFiltersDraft((prev) => ({
                    ...prev,
                    status: event.target.value as CuotasFilters["status"],
                  }))
                }
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Todos</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PAGADA">PAGADA</option>
                <option value="VENCIDA">VENCIDA</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha desde</label>
              <input
                type="date"
                value={props.filtersDraft.dateFrom ?? ""}
                onChange={(e) => props.setFiltersDraft((prev) => ({ ...prev, dateFrom: e.target.value || null }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha hasta</label>
              <input
                type="date"
                value={props.filtersDraft.dateTo ?? ""}
                onChange={(e) => props.setFiltersDraft((prev) => ({ ...prev, dateTo: e.target.value || null }))}
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

export default CuotasFiltersDrawer
