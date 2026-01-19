type Field = { value: string; label: string }

type Props = {
  value: string
  onChange: (val: string) => void
  fields: Field[]
  className?: string
}

export function SortFieldDirection({ value, onChange, fields, className }: Props) {
  const [field, dir] = value ? value.split("_") : [fields[0]?.value ?? "", "asc"]

  const handleFieldChange = (nextField: string) => {
    const next = `${nextField}_${dir ?? "asc"}`
    onChange(next)
  }

  const handleDirChange = (nextDir: "asc" | "desc") => {
    const next = `${field ?? fields[0]?.value}_${nextDir}`
    onChange(next)
  }

  return (
    <div className={"space-y-2 " + (className || "")}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar</label>
      <div className="flex gap-2">
        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value)}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {fields.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDirChange("asc")}
            className={`h-9 w-20 rounded-md border px-3 text-sm font-medium ${value.endsWith("_asc") ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"}`}
            aria-label="Ascendente"
          >
            Asc
          </button>
          <button
            type="button"
            onClick={() => handleDirChange("desc")}
            className={`h-9 w-20 rounded-md border px-3 text-sm font-medium ${value.endsWith("_desc") ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"}`}
            aria-label="Descendente"
          >
            Desc
          </button>
        </div>
      </div>
    </div>
  )
}

export default SortFieldDirection
