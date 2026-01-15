import { useEffect, useRef, useState } from "react"
import { ChevronDown, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "../../lib/utils"
import { dashboardExportService, type DashboardExportRange } from "@/services/dashboardExportService"

const MENU_ITEMS: Array<{ label: string; range: DashboardExportRange }> = [
  { label: "PDF (Vista actual)", range: "current" },
  { label: "PDF (Últimos 7 días)", range: "7d" },
  { label: "PDF (Mes en curso)", range: "month" },
]

export default function DashboardExportButton() {
  const [open, setOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null
      if (!target) return
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const handleExport = async (range: DashboardExportRange) => {
    if (isGenerating) return
    setIsGenerating(true)
    setOpen(false)
    try {
      await dashboardExportService.exportDashboardPdf({ range })
    } catch (err) {
      console.error("Error exportando reporte dashboard:", err)
      toast.error("No se pudo generar el reporte del dashboard. Intenta nuevamente.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => !isGenerating && setOpen((v) => !v)}
        disabled={isGenerating}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50",
          isGenerating && "cursor-not-allowed opacity-70"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isGenerating ? "Generando…" : "Exportar reporte"}
        {!isGenerating && <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />}
      </button>

      {open && !isGenerating ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.range}
              type="button"
              role="menuitem"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => handleExport(item.range)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
