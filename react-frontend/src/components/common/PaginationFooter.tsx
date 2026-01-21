import type { FC } from "react"

type Props = {
  currentPage: number
  totalPages: number
  pageSize: number
  pageSizeOptions: readonly number[]
  onPrev: () => void
  onNext: () => void
  onPageSizeChange: (next: number) => void
  disabledPrev?: boolean
  disabledNext?: boolean
}

export const PaginationFooter: FC<Props> = ({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  onPrev,
  onNext,
  onPageSizeChange,
  disabledPrev,
  disabledNext,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5 flex-wrap">
      <div className="text-sm font-medium text-slate-600">Página {currentPage} de {totalPages}</div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabledPrev ?? currentPage <= 1}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Anterior
        </button>

        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
          {currentPage}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={disabledNext ?? currentPage >= totalPages}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Siguiente
        </button>
      </div>

      <div className="inline-flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-800">Por página</label>
        <select
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default PaginationFooter
