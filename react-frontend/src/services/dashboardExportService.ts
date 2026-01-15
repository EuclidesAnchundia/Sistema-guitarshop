import { api } from "../lib/apiClient"
import { downloadBlob } from "../shared/export/downloadBlob"
import { filenameFromContentDisposition } from "../shared/export/contentDisposition"

export type DashboardExportRange = "current" | "7d" | "month"

export function buildExportUrl(params: { format: "pdf"; range: DashboardExportRange }) {
  const searchParams = new URLSearchParams()
  searchParams.set("format", params.format)
  searchParams.set("range", params.range)
  return `/dashboard/export?${searchParams.toString()}`
}

function fallbackFilename(range: DashboardExportRange) {
  switch (range) {
    case "current":
      return "dashboard_current.pdf"
    case "7d":
      return "dashboard_7d.pdf"
    case "month":
      return "dashboard_month.pdf"
  }
}

export const dashboardExportService = {
  async exportDashboardPdf(params: { range: DashboardExportRange }): Promise<void> {
    const response = await api.get<Blob>(buildExportUrl({ format: "pdf", range: params.range }), {
      responseType: "blob",
    })

    const cd = (response.headers?.["content-disposition"] as string | undefined) ?? undefined
    const filename = filenameFromContentDisposition(cd) ?? fallbackFilename(params.range)

    downloadBlob(response.data, { filename })
  },
}
